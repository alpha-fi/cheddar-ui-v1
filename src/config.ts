const CONTRACT_NAME = 'p2-v1-tt.cheddar.testnet'
const CHEDDAR_CONTRACT_NAME = 'token-v3.cheddar.testnet'
const TOKEN_CONTRACT_NAME = 'test-token.cheddar.testnet'

const TESTNET_NETWORKID = 'testnet'
const TESTNET_NODEURL = 'https://rpc.testnet.near.org'
const TESTNET_WALLETURL = 'https://wallet.testnet.near.org'
const TESTNET_HELPERURL = 'https://helper.testnet.near.org'
const TESTNET_EXPLORERURL = 'https://explorer.testnet.near.org'

type GetConfigResult = {
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
  farms: {
    [index: number]: GetConfigResult;
  }
}

export function getConfig(env:string):GetConfigResults {
  switch (env) {

  case 'production':
  case 'mainnet':
    return {
      "farms": [
      {networkId: 'mainnet',
      nodeUrl: 'https://rpc.mainnet.near.org',
      contractName: CONTRACT_NAME,
      cheddarContractName: CHEDDAR_CONTRACT_NAME,
      tokenContractName: TOKEN_CONTRACT_NAME,
      walletUrl: 'https://wallet.near.org',
      helperUrl: 'https://helper.mainnet.near.org',
      explorerUrl: 'https://explorer.mainnet.near.org',
      keyPath: undefined,
      masterAccount:undefined}
      ]
    }
  case 'development':
  case 'testnet':
    return {
      "farms": [
        {
        networkId: TESTNET_NETWORKID,
        nodeUrl: TESTNET_NODEURL,
        contractName: CONTRACT_NAME,
        cheddarContractName: CHEDDAR_CONTRACT_NAME,
        tokenContractName: TOKEN_CONTRACT_NAME,
        walletUrl: TESTNET_WALLETURL,
        helperUrl: TESTNET_HELPERURL,
        explorerUrl: TESTNET_EXPLORERURL,
        keyPath: undefined,
        masterAccount:undefined,
        },
        {
        networkId: TESTNET_NETWORKID,
        nodeUrl: TESTNET_NODEURL,
        contractName: 'p2-ref.cheddar.testnet',
        cheddarContractName: CHEDDAR_CONTRACT_NAME,
        tokenContractName: 'ref.fakes.testnet',
        walletUrl: TESTNET_WALLETURL,
        helperUrl: TESTNET_HELPERURL,
        explorerUrl: TESTNET_EXPLORERURL,
        keyPath: undefined,
        masterAccount:undefined,
        },
        {
        networkId: TESTNET_NETWORKID,
        nodeUrl: TESTNET_NODEURL,
        contractName: 'p2-meta.cheddar.testnet',
        cheddarContractName: CHEDDAR_CONTRACT_NAME,
        tokenContractName: 'meta-v2.pool.testnet',
        walletUrl: TESTNET_WALLETURL,
        helperUrl: TESTNET_HELPERURL,
        explorerUrl: TESTNET_EXPLORERURL,
        keyPath: undefined,
        masterAccount:undefined,
        },
        {
        networkId: TESTNET_NETWORKID,
        nodeUrl: TESTNET_NODEURL,
        contractName: 'p2-bananas.cheddar.testnet',
        cheddarContractName: CHEDDAR_CONTRACT_NAME,
        tokenContractName: 'berryclub.testnet',
        walletUrl: TESTNET_WALLETURL,
        helperUrl: TESTNET_HELPERURL,
        explorerUrl: TESTNET_EXPLORERURL,
        keyPath: undefined,
        masterAccount:undefined,
        },
      ]
    }
  case 'betanet':
    return {
      "farms": [
      {networkId: 'betanet',
      nodeUrl: 'https://rpc.betanet.near.org',
      cheddarContractName: CHEDDAR_CONTRACT_NAME,
      contractName: CONTRACT_NAME,
      tokenContractName: TOKEN_CONTRACT_NAME,
      walletUrl: 'https://wallet.betanet.near.org',
      helperUrl: 'https://helper.betanet.near.org',
      explorerUrl: 'https://explorer.betanet.near.org',
      keyPath: undefined,
      masterAccount:undefined}
      ]
    }
  case 'local':
    return {
      "farms": [
      {networkId: 'local',
      nodeUrl: 'http://localhost:3030',
      keyPath: `${process.env.HOME}/.near/validator_key.json`,
      walletUrl: 'http://localhost:4000/wallet',
      contractName: CONTRACT_NAME,
      cheddarContractName: CHEDDAR_CONTRACT_NAME,
      tokenContractName: TOKEN_CONTRACT_NAME,
      helperUrl:undefined,
      masterAccount:undefined}
      ]
    }
  case 'test':
  case 'ci':
    return {
      "farms": [
      {networkId: 'shared-test',
      nodeUrl: 'https://rpc.ci-testnet.near.org',
      contractName: CONTRACT_NAME,
      cheddarContractName: CHEDDAR_CONTRACT_NAME,
      tokenContractName: TOKEN_CONTRACT_NAME,
      masterAccount: 'test.near',
      keyPath: undefined,
      walletUrl: 'https://wallet.testnet.near.org'}
      ]
    }
  case 'ci-betanet':
    return {
      "farms": [
      {networkId: 'shared-test-staging',
      nodeUrl: 'https://rpc.ci-betanet.near.org',
      contractName: CONTRACT_NAME,
      cheddarContractName: CHEDDAR_CONTRACT_NAME,
      tokenContractName: TOKEN_CONTRACT_NAME,
      masterAccount: 'test.near',
      keyPath: undefined,
      walletUrl: 'https://wallet.betanet.near.org'}
      ]
    }
  default:
    throw Error(`Unknown environment '${env}'. Can be configured in src/config.js.`)
  }
}
