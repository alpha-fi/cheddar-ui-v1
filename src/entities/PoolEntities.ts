import { NO_CONTRACT_DEPOSIT_NEAR } from "../config";
import { ContractParams } from "../contracts/contract-structs";
import { getNearMetadata } from "../contracts/nearHardcodedObjects";
import { FungibleTokenMetadata, NEP141Trait } from "../contracts/NEP141";
import { StakingPoolNFT } from "../contracts/nft-staking";
import { NFTStakingContractParams } from "../contracts/nft-structures";
import { StakingPoolP1 } from "../contracts/p2-staking";
import { StakingPoolP3 } from "../contracts/p3-staking";
import { P3ContractParams, PoolUserStatusP3 as UserStatusP3 } from "../contracts/p3-structures";
import { disconnectedWallet } from "../wallet-api/disconnected-wallet";
import { U128String } from "../wallet-api/util";
import { WalletInterface } from "../wallet-api/wallet-interface";
import { UserStatusP2 } from "./poolParams";

export async function getTokenContractList(wallet:WalletInterface, contractNameArray: string[]): Promise<TokenContractData[]> {
    let tokenContractList = []
    for(let i = 0; i < contractNameArray.length; i++) {
        const tokenContractName = contractNameArray[i]
        tokenContractList.push(new TokenContractData(wallet, tokenContractName, ""))
    }
    return tokenContractList
}

export class StakingContractDataP3 {
    // Contract to which one staked and unstakes
    contract: StakingPoolP3
    // Staking contract parameters
    // @ts-ignore
    private contractParamsPromise: Promise<P3ContractParams>
    // User parameters of staking contract
    // @ts-ignore
    private userStatusPromise: Promise<UserStatusP3>
    // List of tokens accepted by staking contract 
    private stakeTokenContractListPromise: Promise<TokenContractData[]>
    private contractParams: P3ContractParams | undefined
    private userStatus: UserStatusP3 | undefined
    private stakeTokenContractList: TokenContractData[] = [];
    private farmTokenContractList: TokenContractData[] = [];

    constructor(wallet: WalletInterface, contractId: string) {
        this.contract = new StakingPoolP3(contractId)
        this.contract.wallet = wallet
        this.refreshData()
        this.stakeTokenContractListPromise = this.getStakeTokenContractListPromise()
    }

    refreshData() {
        this.contractParamsPromise = this.contract.get_contract_params()
        if(this.contract.wallet.isConnected()) {
            this.userStatusPromise = this.contract.status()
        }
        this.contractParams = undefined
        this.userStatus = undefined
    }

    async getContractParams(): Promise<P3ContractParams> {
        if(this.contractParams === undefined) {
            this.contractParams = await this.contractParamsPromise
        }
        return this.contractParams
    }

    getContractParamsNotAsync(): P3ContractParams {
        return this.contractParams!
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

    private async getStakeTokenContractListPromise(): Promise<TokenContractData[]> {
        const contractParams = await this.getContractParams();
        return getTokenContractList(this.contract.wallet, contractParams.stake_tokens)
    }

    async getStakeTokenContractList(): Promise<TokenContractData[]> {
        if(this.stakeTokenContractList.length == 0) {
            this.stakeTokenContractList = await this.stakeTokenContractListPromise as TokenContractData[]
            // const contractParams = await this.getContractParams();
            // this.stakeTokenContractList = await getTokenContractList(this.contract.wallet, contractParams.stake_tokens)
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
    private stakeTokenContractList: TokenContractData[]

    constructor(wallet: WalletInterface, contractId: string, stakeTokenContractId: string, poolName: string) {
        this.contract = new StakingPoolP1(contractId)
        this.contract.wallet = wallet
        this.refreshData()

        this.stakeTokenContractList = [new TokenContractData(wallet, stakeTokenContractId, poolName)]
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
        if(this.contractParams.total_staked === undefined) {
            // p1 contracts have the parameter total_stake, while p2 contracts have total_staked. So this is a patch for avoiding changing code
            this.contractParams.total_staked = this.contractParams.total_stake
            this.contractParams.farming_rate = this.contractParams.rewards_per_day
            this.contractParams.total_farmed = this.contractParams.total_rewards
        }
        return this.contractParams
    }

    getContractParamsNotAsync(): ContractParams {
        return this.contractParams!
    }

    async getUserStatus(): Promise<UserStatusP2> {
        if(this.contract.wallet == disconnectedWallet) {
            this.userStatus = new UserStatusP2()
        } else if(this.userStatus === undefined) {
            const userStatus = await this.userStatusPromise
            this.userStatus = new UserStatusP2(userStatus)
        }
        return this.userStatus
    }

    // This method is async so it matches with P3, since in that case, the stake tokens come from contract
    async getStakeTokenContractList(): Promise<TokenContractData[]> {
        return this.stakeTokenContractList
    }
}

export class TokenContractData {
    contract: NEP141Trait | undefined
    wallet: WalletInterface
    private metaDataPromise: Promise<FungibleTokenMetadata> | undefined
    private balancePromise: Promise<U128String> | undefined
    private metaData: FungibleTokenMetadata | undefined
    private balance: U128String | undefined

    constructor(wallet: WalletInterface, contractId: string, poolName: string = "") {
        this.wallet = wallet
        if(contractId !== NO_CONTRACT_DEPOSIT_NEAR) {
            this.contract = new NEP141Trait(contractId)
            this.contract.wallet = wallet

            this.metaDataPromise = this.contract.ft_metadata()
            // TODO Dani check if user is logged
            if(wallet.isConnected()) this.balancePromise = this.contract.ft_balance_of(wallet.getAccountId())
        } else {
            this.metaData = getNearMetadata(poolName)
            this.balancePromise = wallet.getAccountBalance()
        }
    }

    async getMetadata(): Promise<FungibleTokenMetadata> {
        if(!this.metaData) {
            this.metaData = await this.metaDataPromise
            if(this.metaData!.symbol.includes("$")) { // Meta symbol is $META, and this is bad for html selectors
                this.metaData!.symbolForHtml = this.metaData!.symbol.replace("$", "")
            } else {
                this.metaData!.symbolForHtml = this.metaData!.symbol
            }
        }
        return this.metaData!
    }

    getMetadataSync(): FungibleTokenMetadata {
        return this.metaData!
    }

    async getBalance(): Promise<U128String> {
        if(this.contract?.wallet == disconnectedWallet) {
            this.balance = "0"
        } else if(!this.balance) {
            this.balance = await this.balancePromise
        }
        return this.balance!
    }

    getBalanceSync(): U128String {
        // If you get an undefined error, then you either need to use await getBalance() or await Promise.all(list.map(elem => elem.getBalance()))
        return this.balance!
    }

    refreshData() {
        this.balance = undefined
        if(this.contract) {
            this.balancePromise = this.contract.ft_balance_of(this.wallet.getAccountId())
        } else {
            this.balancePromise = this.wallet.getAccountBalance()
        }
    }
}