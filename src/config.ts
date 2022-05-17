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
  poolType: string;
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
  nftContractAddress: string
  farms: Array<GetConfigResult>;
}

export function getConfig(env:string):GetConfigResults {
  switch (env) {

  case 'production':
  case 'mainnet':
    return {
      nftContractAddress: "",
      "farms": [
        {
          index: 0,
          poolType: 'single',
          poolName : 'pulse',
          networkId: MAINNET_NETWORKID,
          nodeUrl: MAINNET_NODEURL,
          contractName: 'p2-pulse.cheddar.near',
          cheddarContractName: CHEDDAR_CONTRACT_NAME,
          tokenContractName: '52a047ee205701895ee06a375492490ec9c597ce.factory.bridge.near',
          walletUrl: MAINNET_WALLETURL,
          helperUrl: MAINNET_HELPERURL,
          explorerUrl: MAINNET_EXPLORERURL,
          keyPath: undefined,
          masterAccount:undefined
        },
        {
          index: 1,
          poolType: 'single',
          poolName : 'nUSDO',
          networkId: MAINNET_NETWORKID,
          nodeUrl: MAINNET_NODEURL,
          contractName: 'p2-nusd.cheddar.near',
          cheddarContractName: CHEDDAR_CONTRACT_NAME,
          tokenContractName: 'v3.oin_finance.near',
          walletUrl: MAINNET_WALLETURL,
          helperUrl: MAINNET_HELPERURL,
          explorerUrl: MAINNET_EXPLORERURL,
          keyPath: undefined,
          masterAccount:undefined
        },
        {
          index: 2,
          poolType: 'single',
          poolName : 'ref',
          networkId: MAINNET_NETWORKID,
          nodeUrl: MAINNET_NODEURL,
          contractName: 'p2-ref.cheddar.near',
          cheddarContractName: CHEDDAR_CONTRACT_NAME,
          tokenContractName: 'token.v2.ref-finance.near',
          walletUrl: MAINNET_WALLETURL,
          helperUrl: MAINNET_HELPERURL,
          explorerUrl: MAINNET_EXPLORERURL,
          keyPath: undefined,
          masterAccount:undefined
        },
        {
          index: 3  ,
          poolType: 'single',
          poolName : 'stNEAR',
          networkId: MAINNET_NETWORKID,
          nodeUrl: MAINNET_NODEURL,
          contractName: 'p2-meta.cheddar.near',
          cheddarContractName: CHEDDAR_CONTRACT_NAME,
          tokenContractName: 'meta-pool.near',
          walletUrl: MAINNET_WALLETURL,
          helperUrl: MAINNET_HELPERURL,
          explorerUrl: MAINNET_EXPLORERURL,
          keyPath: undefined,
          masterAccount:undefined
        },
        {
          index: 4,
          poolType: 'single',
          poolName : 'banana',
          networkId: MAINNET_NETWORKID,
          nodeUrl: MAINNET_NODEURL,
          contractName: 'p2-bananas.cheddar.near',
          cheddarContractName: CHEDDAR_CONTRACT_NAME,
          tokenContractName: 'berryclub.ek.near',
          walletUrl: MAINNET_WALLETURL,
          helperUrl: MAINNET_HELPERURL,
          explorerUrl: MAINNET_EXPLORERURL,
          keyPath: undefined,
          masterAccount:undefined
        },
        {
          index: 5,
          poolType: 'single',
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
          index: 6,
          poolType: 'single',
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
          index: 7,
          poolType: 'single',
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
      nftContractAddress: "nft.cheddar.testnet",
      "farms": [
        {
          index: 0,
          poolType: 'multiple',
          poolName : 'tt',
          networkId: TESTNET_NETWORKID,
          nodeUrl: TESTNET_NODEURL,
          contractName: 'p3-tt.cheddar.testnet',
          cheddarContractName: TESTNET_CHEDDAR_CONTRACT_NAME,
          tokenContractName: 'test-token.cheddar.testnet',
          walletUrl: TESTNET_WALLETURL,
          helperUrl: TESTNET_HELPERURL,
          explorerUrl: TESTNET_EXPLORERURL,
          keyPath: undefined,
          masterAccount:undefined,
        },
        {
          index: 1,
          poolType: 'single',
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
          poolType: 'single',
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
        {
          index: 3,
          poolType: 'single',
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
      ]
    }
  default:
    throw Error(`Unknown environment '${env}'. Can be configured in src/config.js.`)
  }
}
