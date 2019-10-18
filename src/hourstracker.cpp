#include <hourstracker.hpp>

ACTION hourstracker::init(name worker, asset rate) {
  require_auth(worker);
}

ACTION hourstracker::begin(name worker) {
  require_auth(worker);
}

ACTION hourstracker::finish(name worker) {
  require_auth(worker);
}

ACTION hourstracker::withdraw(name worker) {
  require_auth(worker);
}

ACTION hourstracker::fund(name from, name to, asset quantity, string memo) {
  require_auth(from);
}
