import { ContractParams } from "../contracts/contract-structs";
import { FungibleTokenMetadata, NEP141Trait } from "../contracts/NEP141";
import { StakingPoolP3 } from "../contracts/p3-staking";
import { P3ContractParams, Status } from "../contracts/p3-structures";
import { bigintToStringDecLong, convertToDecimals, convertToBase, ntoy, toStringDec, toStringDecLong, yton } from "../util/conversions";
import { U128String } from "../wallet-api/util";
import { WalletInterface } from "../wallet-api/wallet-interface";
import { RewardTokenIconData, UnclaimedRewardsData } from "./genericData";

//JSON compatible struct returned from get_contract_state
export class HtmlPoolParams {
    id: string;
    formId: string;

    constructor(id: string) {
        this.id = id+"-container";
        this.formId = id;
    }
}

export class PoolResultParams {
    // All the numbers that are bigint are expected to be without any decimal points, and are converted when needed
    staked: U128String[] = [];
    farmedUnits: U128String = "";
    farmed: U128String[] = [];
    // computed holds an integer number with no decimal places holding the info about the computed cheddar rewars calculated
    previous_timestamp: number = 0;
    tokenDecimals: Number = 0;
    accName: string = '';

    hasStakedTokens() {
        let hasStakedTokens = false
        for(let i = 0; i < this.staked.length; i++) {
            hasStakedTokens ||= BigInt(this.staked[i]) > 0n
        }
        return hasStakedTokens
    }

    getDisplayableAccountName() {
        return this.accName.length > 22 ? this.accName.slice(0, 10) + ".." + this.accName.slice(-10) : this.accName
    }

    addStaked(amount: U128String[]) {
        // this.staked = this.staked + BigInt(amount)
        // [2938742348, 912387912384] + [92382, 23746]
    }
}

export interface ContractData {
    contract: NEP141Trait
    metaData: FungibleTokenMetadata
    balance: U128String
}

export class PoolParamsP3 {
    wallet: WalletInterface
    index: number
    type: string
    html: HtmlPoolParams;
    stakingContract: StakingPoolP3
    contractParams: P3ContractParams;
    cheddarContract: NEP141Trait;
    // tokenContract: NEP141Trait;
    // stakeTokenContractList: NEP141Trait[] = [];
    stakeTokenContractList: ContractData[] = [];
    farmTokenContractList: ContractData[] = [];
    metaData: FungibleTokenMetadata;
    metaData2: FungibleTokenMetadata;
    resultParams: PoolResultParams;

    constructor(index: number, type:string, html: HtmlPoolParams, stakingContract: StakingPoolP3, cheddarContract: NEP141Trait, wallet: WalletInterface) {
        this.wallet = wallet
        this.index = index;
        this.type = type;
        this.html = html;
        this.stakingContract = stakingContract;
        this.contractParams = new P3ContractParams();
        this.cheddarContract= cheddarContract;
        // this.tokenContract = tokenContract;
        this.resultParams = new PoolResultParams();
        this.metaData = {} as FungibleTokenMetadata;
        this.metaData2 = {} as FungibleTokenMetadata;

        this.stakingContract.wallet = wallet;
        this.cheddarContract.wallet = wallet;
        // this.tokenContract.wallet = wallet;
    }

    async getTokenContractList(contractNameArray: string[]): Promise<ContractData[]> {
        let tokenContractList = []
        for(let i = 0; i < contractNameArray.length; i++) {
            const tokenContractName= contractNameArray[i]
            let contract = new NEP141Trait(tokenContractName)
            contract.wallet = this.wallet
            let metaData = await contract.ft_metadata()
            if(metaData.symbol == "STNEAR") {
                metaData.symbol = "stNEAR";
            }
            tokenContractList.push({
                contract,
                metaData,
                balance: "0"
            })
        }
        return tokenContractList
    }

    async setStakeTokenContractList() {
        this.stakeTokenContractList = await this.getTokenContractList(this.contractParams.stake_tokens)
    }

    async setFarmTokenContractList() {
        this.farmTokenContractList = await this.getTokenContractList(this.contractParams.farm_tokens)   
    }

    async setContractParams() {
        this.contractParams = await this.stakingContract.get_contract_params();
    }

    async setResultParams() {
        const accName = this.stakingContract.wallet.getAccountId()
        let accountInfo: Status = await this.stakingContract.status(accName)

        this.resultParams.staked = accountInfo.stake_tokens
        this.resultParams.farmedUnits = accountInfo.farmed_units
        this.resultParams.farmed = accountInfo.farmed
        this.resultParams.previous_timestamp = accountInfo.timestamp
        // Contract saves previous_timestamp in seconds
        this.resultParams.accName = accName
    }

    async setAllExtraData() {
        await this.setContractParams()
        await this.setStakeTokenContractList()
        await this.setFarmTokenContractList()
        await this.setResultParams()
    }

    getRewardTokenIconData(): RewardTokenIconData[] {
        let dataArray: RewardTokenIconData[] = []
        for(let i = 0; i < this.farmTokenContractList.length; i++) {
            const farmTokenContract = this.farmTokenContractList[i]
            const src = farmTokenContract.metaData.icon ? farmTokenContract.metaData.icon : farmTokenContract.metaData.name
            const data = {
                isSvg: src.includes("<svg"),
                src: src,
                alt: this.metaData.name ? this.metaData.name : "NoName" 
            }
            dataArray.push(data)
        }
        return dataArray
        
    }

    getUnclaimedRewardsData(): UnclaimedRewardsData[] {
        let dataArray: UnclaimedRewardsData[] = []
        let iconDataArray = this.getRewardTokenIconData()
        
        for(let i = 0; i < iconDataArray.length; i++) {
            const iconData = iconDataArray[i]
        
            dataArray.push({
                amount: this.resultParams.farmedUnits[i],
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
                this.resultParams.real_rewards_per_day = totalRewardsPerDay
            }

        } else {
            // I think in this case, the real_rewards_per_day should be 0, since there is nothing in the pool,
            // there is no reward for anyone.
            this.resultParams.real_rewards_per_day = totalRewardsPerDay
        }

        this.resultParams.previous_timestamp = Date.now()
    }

    setStatus(accountInfo: [string, string, string]) {
        // QUESTION Why would accountInfo be undefined|false?
        if(accountInfo) {            
              // QUESTION Should we use indexes instead?
            this.resultParams.staked = accountInfo.stake_tokens;
            this.resultParams.real = BigInt(accountInfo.farmed)
            this.resultParams.previous_timestamp = Number(accountInfo.timestamp)
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
}