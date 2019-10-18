#include <hourstracker.hpp>

ACTION hourstracker::init(name worker, name token, asset rate) {
  require_auth(worker);
  
  auto it = tracker.find(worker.value);
  
  check(it == tracker.end(), "tracker already initialized");
  
  symbol token_symbol = rate.symbol;
  
  tracker.emplace(get_self(), [&](auto& item) {
    item.worker_account = worker;
    item.token_account = token;
    item.rate_per_block = rate;
    item.total_blocks = 0;
    item.paid_blocks = 0;
    item.total_deposit = asset(0, token_symbol);
    item.paid_deposit = asset(0, token_symbol);
    item.current_session = 0;
  });
}

ACTION hourstracker::begin(name worker) {
  require_auth(worker);
  
  auto it = tracker.find(worker.value);
  
  check(it != tracker.end(), "tracker is not initialized");
  check(it->current_session == 0, "session already activated");
  
  tracker.modify(it, get_self(), [&](auto& item) {
    item.current_session = tapos_block_num();
  });
}

ACTION hourstracker::finish(name worker) {
  require_auth(worker);
  
  auto it = tracker.find(worker.value);
  
  check(it != tracker.end(), "tracker is not initialized");
  check(it->current_session > 0, "session is not activated");
  
  uint64_t session_blocks = it->current_session;
  
  tracker.modify(it, get_self(), [&](auto& item) {
    item.total_blocks += session_blocks;
    item.current_session = 0;
  });
}

ACTION hourstracker::withdraw(name worker) {
  require_auth(worker);
  
  auto it = tracker.find(worker.value);
  
  check(it != tracker.end(), "tracker is not activated");
  check(it->current_session == 0, "session is activated");
  check(it->total_deposit - it->paid_deposit > asset(0, it->paid_deposit.symbol), "deposit is empty");
  check(it->total_blocks - it->paid_blocks > 0, "already paid");

  uint64_t total_blocks = it->total_blocks;
  uint64_t paid_blocks = it->paid_blocks;
  uint64_t rate = it->rate_per_block.amount;
  
  uint64_t amount = (total_blocks - paid_blocks) * rate;
  asset quantity = asset(amount, it->paid_deposit.symbol);
  
  tracker.modify(it, get_self(), [&](auto& item) {
    item.paid_blocks = item.total_blocks;
    item.paid_deposit += quantity;
  });
  
  token::transfer_action action{name("eosio.token"), {get_self(), "active"_n}};
  action.send(get_self(), worker, quantity, "");
}

ACTION hourstracker::fund(name caller, name receiver, asset value, string memo) {
  if (receiver != get_self() || caller == get_self()) return;
  
  auto it = tracker.begin();
  
  check(it != tracker.end(), "tracker is not initialized");
  
  tracker.modify(it, get_self(), [&](auto& item) {
    item.total_deposit += value;
  });
}

extern "C" void apply(uint64_t receiver, uint64_t code, uint64_t action) {
  if (action == name("transfer").value && code == name("eosio.token").value) {
    execute_action<hourstracker>(name(receiver), name(code), &hourstracker::fund);
  } else {
    switch (action) {
      case name("init").value:
        execute_action(name(receiver), name(code), &hourstracker::init);
        break;
      case name("begin").value:
        execute_action(name(receiver), name(code), &hourstracker::begin);
        break;
      case name("finish").value:
        execute_action(name(receiver), name(code), &hourstracker::finish);
        break;
      case name("withdraw").value:
        execute_action(name(receiver), name(code), &hourstracker::withdraw);
    }
  }
};