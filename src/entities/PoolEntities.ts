import { ContractParams } from "../contracts/contract-structs";
import { FungibleTokenMetadata, NEP141Trait } from "../contracts/NEP141";
import { StakingPoolP1 } from "../contracts/p2-staking";
import { StakingPoolP3 } from "../contracts/p3-staking";
import { P3ContractParams, PoolUserStatus as UserStatusP3 } from "../contracts/p3-structures";
import { U128String } from "../wallet-api/util";
import { WalletInterface } from "../wallet-api/wallet-interface";
import { UserStatusP2 } from "./poolParams";

async function getTokenContractList(wallet:WalletInterface, contractNameArray: string[]): Promise<TokenContractData[]> {
    let tokenContractList = []
    for(let i = 0; i < contractNameArray.length; i++) {
        const tokenContractName = contractNameArray[i]
        let contract = new NEP141Trait(tokenContractName)
        contract.wallet = wallet
        let metaData = await contract.ft_metadata()
        let balance = await contract.ft_balance_of(wallet.getAccountId())
        if(metaData.symbol == "STNEAR") {
            metaData.symbol = "stNEAR";
        }
        tokenContractList.push({
            contract,
            metaData,
            balance
        })
    }
    return tokenContractList
}

export class StakingContractDataP3 {
    contract: StakingPoolP3
    // @ts-ignore
    private contractParamsPromise: Promise<P3ContractParams>
    // @ts-ignore
    private userStatusPromise: Promise<UserStatusP3>
    private contractParams: P3ContractParams | undefined
    private userStatus: UserStatusP3 | undefined
    private stakeTokenContractList: TokenContractData[] = [];
    private farmTokenContractList: TokenContractData[] = [];

    constructor(wallet: WalletInterface, contractId: string) {
        this.contract = new StakingPoolP3(contractId)
        this.contract.wallet = wallet
        this.refreshData()
    }

    refreshData() {
        this.contractParamsPromise = this.contract.get_contract_params()
        this.userStatusPromise = this.contract.status()
        this.contractParams = undefined
        this.userStatus = undefined
    }

    async getContractParams(): Promise<P3ContractParams> {
        if(this.contractParams === undefined) {
            this.contractParams = await this.contractParamsPromise
        }
        return this.contractParams
    }

    async getUserStatus(): Promise<UserStatusP3> {
        if(this.userStatus === undefined) {
            this.userStatus = await this.userStatusPromise
            if(this.userStatus == null) { // When user is not registered, user status is null
                const contractParams = await this.getContractParams()
                this.userStatus = new UserStatusP3(contractParams.stake_tokens.length, contractParams.farm_tokens.length)
            }
        }
        return this.userStatus
    }

    async getStakeTokenContractList(): Promise<TokenContractData[]> {
        if(this.stakeTokenContractList.length == 0) {
            const contractParams = await this.getContractParams();
            this.stakeTokenContractList = await getTokenContractList(this.contract.wallet, contractParams.stake_tokens)
        }
        return this.stakeTokenContractList
    }

    async getFarmTokenContractList(): Promise<TokenContractData[]> {
        if(this.farmTokenContractList.length == 0) {
            const contractParams = await this.getContractParams();
            this.farmTokenContractList = await getTokenContractList(this.contract.wallet, contractParams.farm_tokens)
        }
        return this.farmTokenContractList
    }
}

export class StakingContractDataP2 {
    contract: StakingPoolP1
    // @ts-ignore
    private contractParamsPromise: Promise<ContractParams>
    // @ts-ignore
    private userStatusPromise: Promise<[U128String, U128String, U128String]>
    private contractParams: ContractParams | undefined
    private userStatus: UserStatusP2 | undefined

    constructor(wallet: WalletInterface, contractId: string) {
        this.contract = new StakingPoolP1(contractId)
        this.contract.wallet = wallet
        this.refreshData()
    }

    

    refreshData() {
        this.contractParamsPromise = this.contract.get_contract_params()
        this.userStatusPromise = this.contract.status()
        this.contractParams = undefined
        this.userStatus = undefined
    }

    async getContractParams(): Promise<ContractParams> {
        if(this.contractParams === undefined) {
            this.contractParams = await this.contractParamsPromise
        }
        return this.contractParams
    }

    async getUserStatus(): Promise<UserStatusP2> {
        if(this.userStatus === undefined) {
            const userStatus = await this.userStatusPromise
            this.userStatus = new UserStatusP2(userStatus)
        }
        return this.userStatus
    }
}

export interface TokenContractData {
    contract: NEP141Trait
    metaData: FungibleTokenMetadata
    balance: U128String
}

// export function getStakingContractDataP3(wallet: WalletInterface, contractId: string): StakingContractDataP3 {
//     let contract = new StakingPoolP3(contractId)
//     contract.wallet = wallet
//     return refreshStakingContractDataP3(contract)
// }

// export function refreshStakingContractDataP3(contract: StakingPoolP3): StakingContractDataP3 {
//     const contractParamsPromise = contract.get_contract_params()
//     const userStatusPromise = contract.status()
//     return {
//         contract,
//         contractParamsPromise,
//         userStatusPromise,
//         contractParams: undefined,
//         userStatus: undefined
//     }
// }

// export function getStakingContractDataP2(wallet: WalletInterface, contractId: string): StakingContractDataP2 {
//     let contract = new StakingPoolP1(contractId)
//     contract.wallet = wallet
//     return refreshStakingContractDataP2(contract)
// }

// export function refreshStakingContractDataP2(contract: StakingPoolP1): StakingContractDataP2 {
//     const contractParamsPromise = contract.get_contract_params()
//     const userStatusPromise = contract.status()
//     return {
//         contract,
//         contractParamsPromise,
//         userStatusPromise,
//         contractParams: undefined,
//         userStatus: undefined
//     }
// }