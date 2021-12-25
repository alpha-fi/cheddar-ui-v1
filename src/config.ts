export const ENV = 'testnet'
export const CHEDDAR_CONTRACT_NAME = 'token.cheddar.near'
export const TESTNET_CHEDDAR_CONTRACT_NAME = 'token-v3.cheddar.testnet'

const MAINNET_NETWORKID = 'mainnet'
const MAINNET_NODEURL = 'https://rpc.mainnet.near.org'
const MAINNET_WALLETURL = 'https://wallet.near.org'
const MAINNET_HELPERURL = 'https://helper.mainnet.near.org'
const MAINNET_EXPLORERURL = 'https://explorer.mainnet.near.org'

const TESTNET_NETWORKID = 'testnet'
const TESTNET_NODEURL = 'https://rpc.testnet.near.org'
const TESTNET_WALLETURL = 'https://wallet.testnet.near.org'
const TESTNET_HELPERURL = 'https://helper.testnet.near.org'
const TESTNET_EXPLORERURL = 'https://explorer.testnet.near.org'

type GetConfigResult = {
  index?: number;
  poolName:string;
  networkId:string;
  nodeUrl:string;
  keyPath?:string;
  contractName:string;
  cheddarContractName:string;
  tokenContractName:string;
  walletUrl:string;
  helperUrl?:string;
  explorerUrl?:string;
  masterAccount?:string;
}

type GetConfigResults = {
  farms: Array<GetConfigResult>;
}

export function getConfig(env:string):GetConfigResults {
  switch (env) {

  case 'production':
  case 'mainnet':
    return {
      "farms": [
        {
          index: 0,
          poolName : 'near',
          networkId: MAINNET_NETWORKID,
          nodeUrl: MAINNET_NODEURL,
          contractName: 'p1-farm.cheddar.near',
          cheddarContractName: CHEDDAR_CONTRACT_NAME,
          tokenContractName: CHEDDAR_CONTRACT_NAME,
          walletUrl: MAINNET_WALLETURL,
          helperUrl: MAINNET_HELPERURL,
          explorerUrl: MAINNET_EXPLORERURL,
          keyPath: undefined,
          masterAccount:undefined
        },
        {
          index: 1,
          poolName : 'cheddar',
          networkId: MAINNET_NETWORKID,
          nodeUrl: MAINNET_NODEURL,
          contractName: 'p2-cheddar.cheddar.near',
          cheddarContractName: CHEDDAR_CONTRACT_NAME,
          tokenContractName: CHEDDAR_CONTRACT_NAME,
          walletUrl: MAINNET_WALLETURL,
          helperUrl: MAINNET_HELPERURL,
          explorerUrl: MAINNET_EXPLORERURL,
          keyPath: undefined,
          masterAccount:undefined,
        },
        {
          index: 2,
          poolName : 'nearcon',
          networkId: MAINNET_NETWORKID,
          nodeUrl: MAINNET_NODEURL,
          contractName: 'farm-nearcon.cheddar.near',
          cheddarContractName: CHEDDAR_CONTRACT_NAME,
          tokenContractName: CHEDDAR_CONTRACT_NAME,
          walletUrl: MAINNET_WALLETURL,
          helperUrl: MAINNET_HELPERURL,
          explorerUrl: MAINNET_EXPLORERURL,
          keyPath: undefined,
          masterAccount:undefined,
        },
      ]
    }
  case 'development':
  case 'testnet':
    return {
      "farms": [
        {
          index: 0,
          poolName : 'ref',
          networkId: TESTNET_NETWORKID,
          nodeUrl: TESTNET_NODEURL,
          contractName: 'p2-ref.cheddar.testnet',
          cheddarContractName: TESTNET_CHEDDAR_CONTRACT_NAME,
          tokenContractName: 'ref.fakes.testnet',
          walletUrl: TESTNET_WALLETURL,
          helperUrl: TESTNET_HELPERURL,
          explorerUrl: TESTNET_EXPLORERURL,
          keyPath: undefined,
          masterAccount:undefined,
        },
        {
          index: 1,
          poolName : 'stNear',
          networkId: TESTNET_NETWORKID,
          nodeUrl: TESTNET_NODEURL,
          contractName: 'p2-meta.cheddar.testnet',
          cheddarContractName: TESTNET_CHEDDAR_CONTRACT_NAME,
          tokenContractName: 'meta-v2.pool.testnet',
          walletUrl: TESTNET_WALLETURL,
          helperUrl: TESTNET_HELPERURL,
          explorerUrl: TESTNET_EXPLORERURL,
          keyPath: undefined,
          masterAccount:undefined,
        },
        {
          index: 2,
          poolName : 'banana',
          networkId: TESTNET_NETWORKID,
          nodeUrl: TESTNET_NODEURL,
          contractName: 'p2-bananas.cheddar.testnet',
          cheddarContractName: TESTNET_CHEDDAR_CONTRACT_NAME,
          tokenContractName: 'berryclub.testnet',
          walletUrl: TESTNET_WALLETURL,
          helperUrl: TESTNET_HELPERURL,
          explorerUrl: TESTNET_EXPLORERURL,
          keyPath: undefined,
          masterAccount:undefined,
        },
      ]
    }
  default:
    throw Error(`Unknown environment '${env}'. Can be configured in src/config.js.`)
  }
}
