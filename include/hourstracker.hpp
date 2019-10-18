#include <eosio/eosio.hpp>
#include <eosio/print.hpp>
#include <eosio/asset.hpp>
#include <eosio/transaction.hpp>

using namespace eosio;
using std::string;

CONTRACT hourstracker : public contract {
  public:
    using contract::contract;
    hourstracker(eosio::name receiver, eosio::name code, datastream<const char*> ds):contract(receiver, code, ds) {}

    ACTION init(name worker, asset rate);
    
    ACTION begin(name worker);
    
    ACTION finish(name worker);
    
    ACTION withdraw(name worker);
    
    ACTION fund(name from, name to, asset quantity, string memo);
  private:
    TABLE trackerStruct {
      name worker_account;
      asset rate_per_block;
      uint64_t tracked_blocks;
      uint64_t paid_blocks;
      
      uint64_t primary_key()const { return worker_account.value; }
    };
  
    typedef eosio::multi_index<"tracker"_n, trackerStruct> tracker;
};

extern "C" void apply(uint64_t receiver, uint64_t code, uint64_t action) {
  if (action == name("transfer").value && code == "hourstoken12"_n.value) {
      execute_action<hourstracker>(name(receiver), name(code), &hourstracker::fund);
  } else if (code == receiver) {
      switch (action) {
        EOSIO_DISPATCH_HELPER(hourstracker, (init)(begin)(finish)(withdraw)(fund))
      }
  }
}
