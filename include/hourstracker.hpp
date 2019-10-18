#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include <eosio/transaction.hpp>
#include <eosio.token.hpp>

using namespace eosio;
using std::string;

CONTRACT hourstracker : public contract {
  public:
    using contract::contract;
    hourstracker(name receiver, name code, datastream<const char*> ds):contract(receiver, code, ds),
    tracker(receiver, receiver.value)
    {}

    ACTION init(name worker, name token, asset rate);
    
    ACTION begin(name worker);
    
    ACTION finish(name worker);
    
    ACTION withdraw(name worker);
    
    ACTION fund(name caller, name receiver, asset value, string memo);
  private:
    TABLE tracker_struct {
      name worker_account;
      name token_account;
      asset rate_per_block;
      asset total_deposit;
      asset paid_deposit;
      uint64_t current_session;
      uint64_t total_blocks;
      uint64_t paid_blocks;
      
      uint64_t primary_key()const { return worker_account.value; }
    };
  
    typedef eosio::multi_index<"tracker"_n, tracker_struct> tracker_table;
    
    tracker_table tracker;
};
