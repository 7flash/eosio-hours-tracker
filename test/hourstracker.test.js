const { describe } = require('riteway')
const eoslime = require('eoslime').init('local')
const fs = require('fs')
const { promisify } = require('util')

const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)

const TOKEN_WASM_PATH = './eosio.token.wasm'
const TOKEN_ABI_PATH = './eosio.token.abi'
const TRACKER_WASM_PATH = './hourstracker.wasm'
const TRACKER_ABI_PATH = './hourstracker.abi'

const deployOrInit = async (wasm, abi, account) => {
  let contract = null
  try {
    contract = await eoslime.AccountDeployer.deploy(wasm, abi, account, { inline: true })
  } catch (err) {
    contract = eoslime.Contract(abi, account.name)
  }
  return contract
}

const getTokenContract = account => deployOrInit(TOKEN_WASM_PATH, TOKEN_ABI_PATH, account)
const getTrackerContract = account => deployOrInit(TRACKER_WASM_PATH, TRACKER_ABI_PATH, account)

const init = async () => {
  try {
    const tokenAccount = await eoslime.Account.createFromName('eosio.token')
    const payerAccount = await eoslime.Account.createFromName('hourspayer12')
    const issuerAccount = await eoslime.Account.createFromName('hoursissuer1')

    const tokenContract = await eoslime.AccountDeployer.deploy(TOKEN_WASM_PATH, TOKEN_ABI_PATH, tokenAccount)
    
    await tokenContract.create(issuerAccount.name, '1000000.0000 SYS')
    await tokenContract.issue(issuerAccount.name, '1000000.0000 SYS', '', { from: issuerAccount })
    await tokenContract.transfer(issuerAccount.name, payerAccount.name, '1000000.0000 SYS', '', { from: issuerAccount })
  
    await writeFile('token.privateKey', tokenAccount.privateKey)
    await writeFile('payer.privateKey', payerAccount.privateKey)
    await writeFile('issuer.privateKey', issuerAccount.privateKey)
  } catch (err) {
  }
}
describe.only('Hours tracker', async assert => {
  await init()

  const tokenPrivateKey = (await readFile('token.privateKey')).toString()
  const payerPrivateKey = (await readFile('payer.privateKey')).toString()
  const issuerPrivateKey = (await readFile('issuer.privateKey')).toString()
  
  const workerAccount = await eoslime.Account.createRandom()
  const trackerAccount = await eoslime.Account.createRandom()
  const tokenAccount = await eoslime.Account.load('eosio.token', tokenPrivateKey)
  const payerAccount = await eoslime.Account.load('hourspayer12', payerPrivateKey)
  const issuerAccount = await eoslime.Account.load('hoursissuer1', issuerPrivateKey)
  
  const tokenContract = await getTokenContract(tokenAccount)
  const trackerContract = await getTrackerContract(trackerAccount)
  
  const payerInitialBalance = Number.parseFloat(await payerAccount.getBalance('SYS', tokenContract.name)) || 0
  const workerInitialBalance = Number.parseFloat(await workerAccount.getBalance('SYS', tokenContract.name)) || 0
  
  console.log('init tracker')
  await trackerContract.init(workerAccount.name, tokenAccount.name, '1.0000 SYS', { from: workerAccount })
  
  console.log('fund tracker')
  await tokenContract.transfer(payerAccount.name, trackerContract.name, '100000.0000 SYS', '', { from: payerAccount })
  
  console.log('begin session')
  await trackerContract.begin(workerAccount.name, { from: workerAccount })
  
  console.log('finish session')
  await trackerContract.finish(workerAccount.name, { from: workerAccount })
  
  console.log('withdraw payment')
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
    given: 'funded tracker',
    should: 'increase deposit',
    actual: Number.parseFloat(trackerTable.rows[0].total_deposit) > 0,
    expected: true
  })

  assert({
    given: 'funded tracker',
    should: 'decrease payer balance',
    actual: payerFinalBalance < payerInitialBalance,
    expected: true
  })

  assert({
    given: 'finished work session',
    should: 'increase working time',
    actual: trackerTable.rows[0].total_blocks > 0,
    expected: true
  })
  
  assert({
    given: 'finished work session',
    should: 'reset current session counter',
    actual: trackerTable.rows[0].current_session,
    expected: 0
  })
  
  assert({
    given: 'payment withdrawal',
    should: 'increase paid time',
    actual: trackerTable.rows[0].paid_blocks > 0,
    expected: true
  })

  assert({
    given: 'payment withdrawal',
    should: 'increase paid amount',
    actual: Number.parseFloat(trackerTable.rows[0].paid_deposit) > 0,
    expected: true
  })
  
  assert({
    given: 'payment withdrawal',
    should: 'increase worker balance',
    actual: workerFinalBalance > workerInitialBalance,
    expected: true
  })
})