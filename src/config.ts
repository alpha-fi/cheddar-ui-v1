export const CHEDDAR_CONTRACT_NAME = 'token.cheddar.near'
export const TESTNET_CHEDDAR_CONTRACT_NAME = 'token-v3.cheddar.testnet'
export const NO_CONTRACT_DEPOSIT_NEAR = "no-contract-deposit-near"

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

export const ENV = TESTNET_NETWORKID

export type FarmData = {
  index?: number;
  poolType: string;
  poolName:string;
  contractName:string;
  tokenContractName:string;
  
}

type GetConfigResults = {
  nftContractAddress: string
  networkId:string;
  nodeUrl:string;
  keyPath?:string;
  cheddarContractName:string;
  walletUrl:string;
  helperUrl?:string;
  explorerUrl?:string;
  masterAccount?:string;
  farms: Array<FarmData>;
}

export function getConfig(env:string):GetConfigResults {
  switch (env) {

  case 'production':
  case 'mainnet':
    return {
      nftContractAddress: "nft.cheddar.near",
      networkId: MAINNET_NETWORKID,
      nodeUrl: MAINNET_NODEURL,
      cheddarContractName: CHEDDAR_CONTRACT_NAME,
      walletUrl: MAINNET_WALLETURL,
      helperUrl: MAINNET_HELPERURL,
      explorerUrl: MAINNET_EXPLORERURL,
      keyPath: undefined,
      masterAccount:undefined,
      "farms": [
        {
          index: 0,
          poolType: 'single',
          poolName : 'pulse',
          // networkId: MAINNET_NETWORKID,
          // nodeUrl: MAINNET_NODEURL,
          contractName: 'p2-pulse.cheddar.near',
          // cheddarContractName: CHEDDAR_CONTRACT_NAME,
          tokenContractName: '52a047ee205701895ee06a375492490ec9c597ce.factory.bridge.near',
          // walletUrl: MAINNET_WALLETURL,
          // helperUrl: MAINNET_HELPERURL,
          // explorerUrl: MAINNET_EXPLORERURL,
          // keyPath: undefined,
          // masterAccount:undefined
        },
        {
          index: 1,
          poolType: 'single',
          poolName : 'nUSDO',
          // networkId: MAINNET_NETWORKID,
          // nodeUrl: MAINNET_NODEURL,
          contractName: 'p2-nusd.cheddar.near',
          // cheddarContractName: CHEDDAR_CONTRACT_NAME,
          tokenContractName: 'v3.oin_finance.near',
          // walletUrl: MAINNET_WALLETURL,
          // helperUrl: MAINNET_HELPERURL,
          // explorerUrl: MAINNET_EXPLORERURL,
          // keyPath: undefined,
          // masterAccount:undefined
        },
        {
          index: 2,
          poolType: 'single',
          poolName : 'ref',
          // networkId: MAINNET_NETWORKID,
          // nodeUrl: MAINNET_NODEURL,
          contractName: 'p2-ref.cheddar.near',
          // cheddarContractName: CHEDDAR_CONTRACT_NAME,
          tokenContractName: 'token.v2.ref-finance.near',
          // walletUrl: MAINNET_WALLETURL,
          // helperUrl: MAINNET_HELPERURL,
          // explorerUrl: MAINNET_EXPLORERURL,
          // keyPath: undefined,
          // masterAccount:undefined
        },
        {
          index: 3  ,
          poolType: 'single',
          poolName : 'stNEAR',
          // networkId: MAINNET_NETWORKID,
          // nodeUrl: MAINNET_NODEURL,
          contractName: 'p2-meta.cheddar.near',
          // cheddarContractName: CHEDDAR_CONTRACT_NAME,
          tokenContractName: 'meta-pool.near',
          // walletUrl: MAINNET_WALLETURL,
          // helperUrl: MAINNET_HELPERURL,
          // explorerUrl: MAINNET_EXPLORERURL,
          // keyPath: undefined,
          // masterAccount:undefined
        },
        {
          index: 4,
          poolType: 'single',
          poolName : 'banana',
          // networkId: MAINNET_NETWORKID,
          // nodeUrl: MAINNET_NODEURL,
          contractName: 'p2-bananas.cheddar.near',
          // cheddarContractName: CHEDDAR_CONTRACT_NAME,
          tokenContractName: 'berryclub.ek.near',
          // walletUrl: MAINNET_WALLETURL,
          // helperUrl: MAINNET_HELPERURL,
          // explorerUrl: MAINNET_EXPLORERURL,
          // keyPath: undefined,
          // masterAccount:undefined
        },
        {
          index: 5,
          poolType: 'single',
          poolName : 'Near',
          // networkId: MAINNET_NETWORKID,
          // nodeUrl: MAINNET_NODEURL,
          contractName: 'p1-farm.cheddar.near',
          // cheddarContractName: CHEDDAR_CONTRACT_NAME,
          tokenContractName: NO_CONTRACT_DEPOSIT_NEAR,
          // walletUrl: MAINNET_WALLETURL,
          // helperUrl: MAINNET_HELPERURL,
          // explorerUrl: MAINNET_EXPLORERURL,
          // keyPath: undefined,
          // masterAccount:undefined
        },
        {
          index: 6,
          poolType: 'single',
          poolName : 'cheddar',
          // networkId: MAINNET_NETWORKID,
          // nodeUrl: MAINNET_NODEURL,
          contractName: 'p2-cheddar.cheddar.near',
          // cheddarContractName: CHEDDAR_CONTRACT_NAME,
          tokenContractName: CHEDDAR_CONTRACT_NAME,
          // walletUrl: MAINNET_WALLETURL,
          // helperUrl: MAINNET_HELPERURL,
          // explorerUrl: MAINNET_EXPLORERURL,
          // keyPath: undefined,
          // masterAccount:undefined,
        },
        {
          index: 7,
          poolType: 'single',
          poolName : 'Nearcon',
          // networkId: MAINNET_NETWORKID,
          // nodeUrl: MAINNET_NODEURL,
          contractName: 'farm-nearcon.cheddar.near',
          // cheddarContractName: CHEDDAR_CONTRACT_NAME,
          tokenContractName: NO_CONTRACT_DEPOSIT_NEAR,
          // walletUrl: MAINNET_WALLETURL,
          // helperUrl: MAINNET_HELPERURL,
          // explorerUrl: MAINNET_EXPLORERURL,
          // keyPath: undefined,
          // masterAccount:undefined,
        },
        {
          index: 8,
          poolType: 'multiple',
          poolName : 'cheddar-ref-burrow',
          contractName: 'p3-ref-bbr.cheddar.near',
          tokenContractName: CHEDDAR_CONTRACT_NAME,
        },
        {
          index: 9,
          poolType: 'multiple',
          poolName : 'cheddar-meta',
          contractName: 'p3-meta.cheddar.near',
          tokenContractName: CHEDDAR_CONTRACT_NAME,
        },
      ]
    }
  case 'development':
  case 'testnet':
    return {
      nftContractAddress: "nft.cheddar.testnet",
      networkId: TESTNET_NETWORKID,
      nodeUrl: TESTNET_NODEURL,
      cheddarContractName: TESTNET_CHEDDAR_CONTRACT_NAME,
      walletUrl: TESTNET_WALLETURL,
      helperUrl: TESTNET_HELPERURL,
      explorerUrl: TESTNET_EXPLORERURL,
      keyPath: undefined,
      masterAccount:undefined,
      "farms": [
        {
          index: 0,
          poolType: 'multiple',
          poolName : 'tt',
          contractName: 'p3-tt.cheddar.testnet',
          tokenContractName: 'test-token.cheddar.testnet',
        },
        {
          index: 1,
          poolType: 'single',
          poolName : 'stNear',
          contractName: 'p2-meta.cheddar.testnet',
          tokenContractName: 'meta-v2.pool.testnet',
        },
        {
          index: 2,
          poolType: 'single',
          poolName : 'banana',
          contractName: 'p2-bananas.cheddar.testnet',
          tokenContractName: 'berryclub.testnet',
        },
        {
          index: 3,
          poolType: 'single',
          poolName : 'ref',
          contractName: 'p2-ref.cheddar.testnet',
          tokenContractName: 'ref.fakes.testnet',
        },
        {
          index: 4,
          poolType: 'nft',
          poolName : 'Cheddy-nft',
          contractName: 'cheddy-nft.cheddar.testnet',
          tokenContractName: 'token-v3.cheddar.testnet',
        },
      ]
    }
  default:
    throw Error(`Unknown environment '${env}'. Can be configured in src/config.js.`)
  }
}
