const CONTRACT_NAME = 'p1.cheddar.testnet'
const TOKEN_CONTRACT_NAME = 'token.cheddar.testnet'

type GetConfigResult = {
  networkId:string;
  nodeUrl:string;
  keyPath?:string;
  contractName:string;
  tokenContractName:string;
  walletUrl:string;
  helperUrl?:string;
  explorerUrl?:string;
  masterAccount?:string;
}

export function getConfig(env:string):GetConfigResult {
  switch (env) {

  case 'production':
  case 'mainnet':
    return {
      networkId: 'mainnet',
      nodeUrl: 'https://rpc.mainnet.near.org',
      contractName: CONTRACT_NAME,
      tokenContractName: TOKEN_CONTRACT_NAME,
      walletUrl: 'https://wallet.near.org',
      helperUrl: 'https://helper.mainnet.near.org',
      explorerUrl: 'https://explorer.mainnet.near.org',
      keyPath: undefined,
      masterAccount:undefined,
    }
  case 'development':
  case 'testnet':
    return {
      networkId: 'testnet',
      nodeUrl: 'https://rpc.testnet.near.org',
      contractName: CONTRACT_NAME,
      tokenContractName: TOKEN_CONTRACT_NAME,
      walletUrl: 'https://wallet.testnet.near.org',
      helperUrl: 'https://helper.testnet.near.org',
      explorerUrl: 'https://explorer.testnet.near.org',
      keyPath: undefined,
      masterAccount:undefined,
    }
  case 'betanet':
    return {
      networkId: 'betanet',
      nodeUrl: 'https://rpc.betanet.near.org',
      contractName: CONTRACT_NAME,
      tokenContractName: TOKEN_CONTRACT_NAME,
      walletUrl: 'https://wallet.betanet.near.org',
      helperUrl: 'https://helper.betanet.near.org',
      explorerUrl: 'https://explorer.betanet.near.org',
      keyPath: undefined,
      masterAccount:undefined,
    }
  case 'local':
    return {
      networkId: 'local',
      nodeUrl: 'http://localhost:3030',
      keyPath: `${process.env.HOME}/.near/validator_key.json`,
      walletUrl: 'http://localhost:4000/wallet',
      contractName: CONTRACT_NAME,
      tokenContractName: TOKEN_CONTRACT_NAME,
      helperUrl:undefined,
      masterAccount:undefined,
    }
  case 'test':
  case 'ci':
    return {
      networkId: 'shared-test',
      nodeUrl: 'https://rpc.ci-testnet.near.org',
      contractName: CONTRACT_NAME,
      tokenContractName: TOKEN_CONTRACT_NAME,
      masterAccount: 'test.near',
      keyPath: undefined,
      walletUrl: 'https://wallet.testnet.near.org',
    }
  case 'ci-betanet':
    return {
      networkId: 'shared-test-staging',
      nodeUrl: 'https://rpc.ci-betanet.near.org',
      contractName: CONTRACT_NAME,
      tokenContractName: TOKEN_CONTRACT_NAME,
      masterAccount: 'test.near',
      keyPath: undefined,
      walletUrl: 'https://wallet.betanet.near.org',
    }
  default:
    throw Error(`Unknown environment '${env}'. Can be configured in src/config.js.`)
  }
}
