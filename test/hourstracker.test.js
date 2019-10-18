const { describe } = require('riteway')
const eoslime = require('eoslime').init('local')

const TOKEN_WASM_PATH = './eosio.token.wasm'
const TOKEN_ABI_PATH = './eosio.token.abi'
const TRACKER_WASM_PATH = './hourstracker.wasm'
const TRACKER_ABI_PATH = './hourstracker.abi'

describe('Hours tracker', async assert => {
  const tokenAccount = await eoslime.Account.createRandom()

  const issuerAccount = await eoslime.Account.createRandom()

  const payerAccount = await eoslime.Account.createRandom()
  
  const workerAccount = await eoslime.Account.createRandom()
  
  const tokenContract = await eoslime.CleanDeployer.deploy(TOKEN_WASM_PATH, TOKEN_ABI_PATH)
  
  const trackerContract = await eoslime.CleanDeployer.deploy(TRACKER_WASM_PATH, TRACKER_ABI_PATH, { inline: true })
  
  await tokenContract.create(issuerAccount.name, '1000000.0000 SYS')
  
  await tokenContract.issue(payerAccount.name, '1000000.0000 SYS', '', { from: issuerAccount })

  const payerInitialBalance = Number.parseFloat(await payerAccount.getBalance('SYS', tokenContract.name))
  
  const workerInitialBalance = Number.parseFloat(await workerAccount.getBalance('SYS', tokenContract.name))
  
  await trackerContract.init(workerAccount.name, '1.0000 SYS', { from: workerAccount })
  
  await tokenContract.transfer(payerAccount.name, trackerContract.name, '10.0000 SYS', '', { from: payerAccount })
  
  await trackerContract.begin(workerAccount.name, { from: workerAccount })
  
  await trackerContract.finish(workerAccount.name, { from: workerAccount })
  
  await trackerContract.withdraw(workerAccount.name, { from: workerAccount })
  
  const payerFinalBalance = Number.parseFloat(await payerAccount.getBalance('SYS', tokenContract.name))
  
  const workerFinalBalance = Number.parseFloat(await workerAccount.getBalance('SYS', tokenContract.name))

  const trackerTable = await trackerContract.provider.eos.getTableRows({
    code: trackerContract.name,
    scope: trackerContract.name,
    table: 'tracker',
    json: true
  })

  assert({
    given: 'finished work session',
    should: 'increase working time',
    given: trackerTable.rows[0].tracked_blocks,
    expected: 1
  })
  
  assert({
    given: 'requested payment withdrawal',
    should: 'increase paid time',
    given: trackerTable.rows[1].paid_blocks,
    expected: 1
  })
  
  assert({
    given: 'requested payment withdrawal',
    should: 'send tokens from contract to worker',
    given: payerFinalBalance > payerInitialBalance && workerFinalBalance < workerInitialBalance,
    expected: true
  })
})