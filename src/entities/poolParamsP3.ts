import { FarmData } from "../config";
import { ContractParams } from "../contracts/contract-structs";
import { callMulipleTransactions } from "../contracts/multipleCall";
import { FungibleTokenMetadata, NEP141Trait } from "../contracts/NEP141";
import { NFTContract } from "../contracts/NFTContract";
import { StakingPoolP3 } from "../contracts/p3-staking";
import { P3ContractParams } from "../contracts/p3-structures";
import { bigintToStringDecLong, convertToDecimals, convertToBase, ntoy, toStringDec, toStringDecLong, yton } from "../util/conversions";
import { U128String } from "../wallet-api/util";
import { WalletInterface } from "../wallet-api/wallet-interface";
import { DetailRow, DetailRowElements, RewardsTokenData, TokenIconData, UnclaimedRewardsData } from "./genericData";
import { getStakingContractDataP3, StakingContractDataP3 } from "./PoolEntities";

//JSON compatible struct returned from get_contract_state
export class HtmlPoolParams {
    id: string;
    formId: string;

    constructor(id: string) {
        this.id = id+"-container";
        this.formId = id;
    }
}

export class PoolUserStatus {
    // All the numbers that are bigint are expected to be without any decimal points, and are converted when needed
    staked: U128String[] = [];
    farmedUnits: U128String = "0";
    farmed: U128String[] = [];
    // computed holds an integer number with no decimal places holding the info about the computed cheddar rewars calculated
    previous_timestamp: number = 0;
    tokenDecimals: Number = 0;
    accName: string = '';
    cheddy_nft: string = '';

    constructor(stakedTokensLength: number, farmedTokensLength: number) {
        this.staked = new Array(stakedTokensLength).fill("0")
        this.farmed = new Array(farmedTokensLength).fill("0")
    }

    

    getDisplayableAccountName() {
        return this.accName.length > 22 ? this.accName.slice(0, 10) + ".." + this.accName.slice(-10) : this.accName
    }

    addStaked(amountArray: bigint[]) {
        for (let i = 0; i < amountArray.length; i++){
            this.staked[i] = (BigInt(this.staked[i]) + amountArray[i]).toString()
        }
    }
}

export interface TokenContractData {
    contract: NEP141Trait
    metaData: FungibleTokenMetadata
    balance: U128String
}

export class PoolParamsP3 {
    wallet: WalletInterface
    type: string
    html: HtmlPoolParams;

    stakingContractData: StakingContractDataP3
    // stakingContract: StakingPoolP3
    // stakingContractMetaData: FungibleTokenMetadata;
    // contractParams: P3ContractParams;
    // poolUserStatus: PoolUserStatus = new PoolUserStatus(0, 0);

    // cheddarContract: NEP141Trait;
    // tokenContract: NEP141Trait;
    // stakeTokenContractList: NEP141Trait[] = [];
    stakeTokenContractList: TokenContractData[] = [];
    farmTokenContractList: TokenContractData[] = [];
    // metaData2: FungibleTokenMetadata;

    nftContract: NFTContract

    constructor(wallet: WalletInterface, farmData: FarmData, nftContract: string) {
        this.wallet = wallet
        this.type = farmData.poolType;

        this.html = new HtmlPoolParams(farmData.poolName);
        this.stakingContractData = getStakingContractDataP3(wallet, farmData.contractName)

        this.nftContract = new NFTContract(nftContract)
        this.nftContract.wallet = this.wallet
    }

    async userHasStakedTokens() {
        const poolUserStatus = await this.stakingContractData.contractParamsPromise
        let hasStakedTokens = false
        for(let i = 0; i < poolUserStatus.stake_tokens.length; i++) {
            hasStakedTokens ||= BigInt(poolUserStatus.stake_tokens[i]) > 0n
        }
        return hasStakedTokens
    }

    // constructor(index: number, type:string, html: HtmlPoolParams, stakingContract: StakingPoolP3, cheddarContract: NEP141Trait, nftContract: string, wallet: WalletInterface) {
    //     this.wallet = wallet
    //     this.type = type;
    //     this.html = html;
    //     this.stakingContract = stakingContract;
    //     this.stakingContract.wallet = wallet;

    //     this.contractParams = new P3ContractParams();
    //     this.cheddarContract= cheddarContract;
    //     // this.tokenContract = tokenContract;
    //     // this.resultParams = new PoolResultParams();
    //     this.stakingContractMetaData = {} as FungibleTokenMetadata;
    //     this.metaData2 = {} as FungibleTokenMetadata;
    //     this.nftContract = new NFTContract(nftContract)

    //     this.cheddarContract.wallet = wallet;
    //     this.nftContract.wallet = wallet
    //     // this.tokenContract.wallet = wallet;
    // }

    async getTokenContractList(contractNameArray: string[]): Promise<TokenContractData[]> {
        let tokenContractList = []
        for(let i = 0; i < contractNameArray.length; i++) {
            const tokenContractName= contractNameArray[i]
            let contract = new NEP141Trait(tokenContractName)
            contract.wallet = this.wallet
            let metaData = await contract.ft_metadata()
            let balance = await contract.ft_balance_of(this.wallet.getAccountId())
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

    getPoolName() {
        let tokenNames: string[] = []
        for(let i = 0; i < this.stakeTokenContractList.length; i++) {
            const tokenContractData = this.stakeTokenContractList[i]
            tokenNames.push(tokenContractData.metaData.symbol)
        }
        const names = tokenNames.join(" - ")
        if(names.length > 20) {
            return names.substring(0, 7) + "..." + names.substring(names.length - 7)
        } else {
            return names
        }
    }

    async getStakeTokenContractList() {
        const contractParams = await this.stakingContractData.contractParamsPromise
        return await this.getTokenContractList(contractParams.stake_tokens)
    }

    async getFarmTokenContractList() {
        const contractParams = await this.stakingContractData.contractParamsPromise
        return await this.getTokenContractList(contractParams.farm_tokens)   
    }

    // async setContractParams() {
    //     this.stakingContractData.contractParamsPromise = this.stakingContractData.contract.get_contract_params();
    // }

    // async setResultParams() {
    //     const accName = this.stakingContract.wallet.getAccountId()
    //     let accountInfo: PoolUserStatus = await this.stakingContract.status(accName)
    //     if(!accountInfo) {
    //         const stakeTokensLength = this.contractParams.stake_tokens.length
    //         const farmTokensLength = this.contractParams.farm_tokens.length
    //         this.poolUserStatus = new PoolUserStatus(stakeTokensLength, farmTokensLength)
    //         return
    //     }
    
    //     this.poolUserStatus.staked = accountInfo.stake_tokens
    //     this.poolUserStatus.farmedUnits = accountInfo.farmed_units
    //     this.poolUserStatus.farmed = accountInfo.farmed_tokens
    //     this.poolUserStatus.previous_timestamp = accountInfo.timestamp
    //     this.poolUserStatus.cheddy_nft = accountInfo.cheddy_nft
    //     // Contract saves previous_timestamp in seconds
    //     this.poolUserStatus.accName = accName
    // }

    async setAllExtraData() {
        // await this.setContractParams()
        // await this.setStakeTokenContractList()
        // await this.setFarmTokenContractList()
        // await this.setResultParams()
    }

    async refreshAllExtraData() {
        // await this.setContractParams()
        // await this.setResultParams()
        // await this.setStakeTokenContractList()
    }

    async stake(amounts: bigint[]) {
        let TXs = []
        for(let i = 0; i < this.stakeTokenContractList.length; i++) {
            const stakeContract = this.stakeTokenContractList[i]
            const promise = stakeContract.contract.ft_transfer_call_without_send(
                this.stakingContract.contractId, 
                amounts[i].toString()
            )
            const promiseWithContract = {
            promise,
            contractName: stakeContract.contract.contractId
            }

            TXs.push(promiseWithContract)
        }
        await callMulipleTransactions(TXs, this.stakingContract)   
    }

    async unstake(amounts: bigint[]) {
        let TXs = []
        for(let i = 0; i < this.stakeTokenContractList.length; i++) {
            const stakeContract = this.stakeTokenContractList[i]
            const promise = stakeContract.contract.unstake_without_send(
                stakeContract.contract.contractId, 
                amounts[i].toString()
            )
            const promiseWithContract = {
            promise,
            contractName: this.stakingContract.contractId
            }

            TXs.push(promiseWithContract)
        }
        await callMulipleTransactions(TXs, this.stakingContract)   
    }

    getStakeTokensDetail(): DetailRow[]{
        let dataArray: DetailRow[] = []
        for(let i = 0; i < this.stakeTokenContractList.length; i++) {
            const stakeTokenContract = this.stakeTokenContractList[i]
            const iconData = this.getIcon(stakeTokenContract)
            const totalStaked = convertToDecimals(this.contractParams.total_staked[i], stakeTokenContract.metaData.decimals, 5)

            dataArray.push({
                iconData,
                content: totalStaked
            })
        }
        return dataArray
    }

    getRewardsTokenDetail(): RewardsTokenData[] {
        let dataArray: RewardsTokenData[] = []
        for(let i = 0; i < this.farmTokenContractList.length; i++) {
            const farmTokenContract = this.farmTokenContractList[i]
            const iconData = this.getIcon(farmTokenContract)
            const tokenName = farmTokenContract.metaData.name
            const rewardsPerDayBN = BigInt(this.contractParams.farm_token_rates[i]) * 60n * 24n
            const rewardsPerDay = convertToDecimals(rewardsPerDayBN, farmTokenContract.metaData.decimals, 5)
            const totalRewards = convertToDecimals(this.contractParams.total_farmed[i], farmTokenContract.metaData.decimals, 5)
            const userUnclaimedRewards = convertToDecimals(this.poolUserStatus.farmed[i], farmTokenContract.metaData.decimals, 5)

            dataArray.push({
                iconData,
                tokenName,
                rewardsPerDay,
                totalRewards,
                userUnclaimedRewards,
            })
        }
        return dataArray
    }

    getIcon(contractData: TokenContractData): TokenIconData{
        const src = contractData.metaData.icon ? contractData.metaData.icon : contractData.metaData.name
        return {
            isSvg: src.includes("<svg"),
            src: src,
            tokenName: contractData.metaData.name ? contractData.metaData.name : "NoName"
        }
    }
    
    getStakedTokenIconData(): TokenIconData[] {
        let dataArray: TokenIconData[] = []
        for(let i = 0; i < this.stakeTokenContractList.length; i++) {
            const stakeTokenContract = this.stakeTokenContractList[i]
            const src = stakeTokenContract.metaData.icon ? stakeTokenContract.metaData.icon : stakeTokenContract.metaData.name
            const data = {
                isSvg: src.includes("<svg"),
                src: src,
                tokenName: stakeTokenContract.metaData.name ? stakeTokenContract.metaData.name : "NoName"
            }
            dataArray.push(data)
        }
        return dataArray
        
    }

    getRewardTokenIconData(): TokenIconData[] {
        let dataArray: TokenIconData[] = []
        for(let i = 0; i < this.farmTokenContractList.length; i++) {
            const farmTokenContract = this.farmTokenContractList[i]
            const src = farmTokenContract.metaData.icon ? farmTokenContract.metaData.icon : farmTokenContract.metaData.name
            const data = {
                isSvg: src.includes("<svg"),
                src: src,
                tokenName: farmTokenContract.metaData.name ? farmTokenContract.metaData.name : "NoName"
            }
            dataArray.push(data)
        }
        return dataArray
        
    }

    getStakeTokensData(): {

    }
    
    getUnclaimedRewardsData(): UnclaimedRewardsData[] {
        let dataArray: UnclaimedRewardsData[] = []
        let iconDataArray = this.getRewardTokenIconData()
        // const accName = this.stakingContract.wallet.getAccountId()
        // const status: Status = await this.stakingContract.status(accName)
        console.log("UNCLAIMED REWARDS", this.poolUserStatus.farmed)
        
        for(let i = 0; i < iconDataArray.length; i++) {
            const iconData = iconDataArray[i]
            // TODO Fix when Henry answers how we should handle the unclaimed rewards
            const amount = convertToDecimals(this.poolUserStatus.farmed[i], this.farmTokenContractList[i].metaData.decimals, 5)
            dataArray.push({
                amount: amount,
                iconData: iconData
            })
        }
        return dataArray
        
    }

    setTotalRewardsPerDay() {


        /*** Workaround Free Community Farm pool ***/
        let totalRewardsPerDay = 0n
        let primaryStake = 0n
        let secondaryStake = 0n
        
        /** TODO - make dynamic **/
        totalRewardsPerDay = BigInt(this.contractParams.farm_token_rates[0]) * BigInt(60 * 24)

        primaryStake = BigInt(this.contractParams.total_staked[0])
        secondaryStake = BigInt(this.contractParams.total_staked[1])
        
        // else {
        //     totalRewardsPerDay = BigInt(this.contractParams.rewards_per_day)
        //     primaryStake = BigInt(this.contractParams.total_stake)
        // }

        // const staked = this.resultParams.staked


        if(primaryStake > BigInt(0)) {

            /*** Workaround Free Community Farm pool ***/

            if(this.contractParams.farming_rate) {

                /** TODO - Rewrite  **/
                // QUESTION How to rewrite? So it doesn't throw any errors?
                // let rewardsPerDay = BigInt(yton(totalRewardsPerDay)) * (BigInt(convertToDecimals(staked, this.metaData.decimals, 10)) / BigInt(convertToDecimals(primaryStake, this.metaData.decimals, 10)))
                
                // this.resultParams.real_rewards_per_day = BigInt(convertToBase(rewardsPerDay.toString(), "24"))

                // console.log("Total Rewards Per Day ", yton(totalRewardsPerDay))
                // console.log("Staked: ", convertToDecimals(staked, this.metaData.decimals, 10))
                // console.log("Total Staked: ", convertToDecimals(primaryStake, this.metaData.decimals, 10))
                // console.log("Fraction of Stake ", convertToDecimals(staked, this.metaData.decimals, 10) / convertToDecimals(primaryStake, this.metaData.decimals, 10))
                // console.log("Rewards Per Day ", yton(totalRewardsPerDay) * (convertToDecimals(staked, this.metaData.decimals, 10) / convertToDecimals(primaryStake, this.metaData.decimals, 10)))
            } else if(this.contractParams.farm_token_rates) {
                /** TODO - Implement **/
            } else {
                this.poolUserStatus.real_rewards_per_day = totalRewardsPerDay
            }

        } else {
            // I think in this case, the real_rewards_per_day should be 0, since there is nothing in the pool,
            // there is no reward for anyone.
            this.poolUserStatus.real_rewards_per_day = totalRewardsPerDay
        }

        this.poolUserStatus.previous_timestamp = Date.now()
    }

    setStatus(accountInfo: [string, string, string]) {
        // QUESTION Why would accountInfo be undefined|false?
        if(accountInfo) {            
              // QUESTION Should we use indexes instead?
            this.poolUserStatus.staked = accountInfo.stake_tokens;
            this.poolUserStatus.real = BigInt(accountInfo.farmed)
            this.poolUserStatus.previous_timestamp = Number(accountInfo.timestamp)
        }
    }

    // async getWalletAvailableOLD() {
    //     let walletAvailable = 0
    //     let balance = await this.tokenContract.ft_balance_of(this.stakingContract.wallet.getAccountId())
    //     walletAvailable = Number(convertToDecimals(balance, this.metaData.decimals, 5))
    //     return walletAvailable
    // }

    async getWalletAvailable(): Promise<U128String[]> {
        let walletAvailable: U128String[] = []
        const accName = await this.wallet.getAccountId()
        for(let i = 0; i < this.stakeTokenContractList.length; i++) {
            const contractData = this.stakeTokenContractList[i]
            let balance = await contractData.contract.ft_balance_of(accName)
            contractData.balance = balance
            walletAvailable.push(balance)
        }
        return walletAvailable
    }

    
    async getWalletAvailableDisplayable() {
        const available = await this.getWalletAvailable()
        const availableDisplayableArray = []
        for (let i = 0; i < available.length; i++) {
            availableDisplayableArray.push(convertToDecimals(available[i], this.stakingContractMetaData.decimals, 5))    
        }
        return availableDisplayableArray
    }
}