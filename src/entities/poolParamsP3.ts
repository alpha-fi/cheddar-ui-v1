import { ContractParams } from "../contracts/contract-structs";
import { FungibleTokenMetadata, NEP141Trait } from "../contracts/NEP141";
import { StakingPoolP3 } from "../contracts/p3-staking";
import { P3ContractParams, Status } from "../contracts/p3-structures";
import { bigintToStringDecLong, convertToDecimals, convertToBase, ntoy, toStringDec, toStringDecLong, yton } from "../util/conversions";
import { U128String } from "../wallet-api/util";
import { WalletInterface } from "../wallet-api/wallet-interface";

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

    getDisplayableComputed() {
        return convertToDecimals(this.computed.toString(), 24, 7)
    }

    getCurrentCheddarRewards() {
        return yton(this.computed.toString())
    }

    getCurrentDisplayableCheddarRewards() {
        return convertToDecimals(this.computed.toString(), 24, 7)
    }

    getDisplayableAccountName() {
        return this.accName.length > 22 ? this.accName.slice(0, 10) + ".." + this.accName.slice(-10) : this.accName
    }

    addStaked(amount: string) {
        this.staked = this.staked + BigInt(amount)
    }
}

export class PoolParamsP3 {
    index: number
    type: string
    html: HtmlPoolParams;
    contract: StakingPoolP3
    contractParams: P3ContractParams;
    cheddarContract: NEP141Trait;
    tokenContract: NEP141Trait;
    metaData: FungibleTokenMetadata;
    metaData2: FungibleTokenMetadata;
    resultParams: PoolResultParams;

    constructor(index: number, type:string, html: HtmlPoolParams, contract: StakingPoolP3, cheddarContract: NEP141Trait, tokenContract: NEP141Trait, resultParams: PoolResultParams, wallet: WalletInterface) {
        this.index = index;
        this.type = type;
        this.html = html;
        this.contract = contract;
        this.contractParams = new P3ContractParams();
        this.cheddarContract= cheddarContract;
        this.tokenContract = tokenContract;
        this.resultParams = resultParams;
        this.metaData = {} as FungibleTokenMetadata;
        this.metaData2 = {} as FungibleTokenMetadata;

        this.contract.wallet = wallet;
        this.cheddarContract.wallet = wallet;
        this.tokenContract.wallet = wallet;
    }

    async setContractParams() {
        this.contractParams = await this.contract.get_contract_params();
    }

    async setMetaData() {
        this.metaData = await this.tokenContract.ft_metadata()
        if(this.metaData.symbol == "STNEAR") {
            this.metaData.symbol = "stNEAR";
        }

        this.metaData2 = await this.cheddarContract.ft_metadata()
    }

    async setResultParams() {
        const accName = this.contract.wallet.getAccountId()
        let accountInfo: Status = await this.contract.status(accName)

        this.resultParams.staked = accountInfo.stake_tokens
        this.resultParams.farmedUnits = accountInfo.farmed_units
        this.resultParams.farmed = accountInfo.farmed
        this.resultParams.previous_timestamp = accountInfo.timestamp
        // Contract saves previous_timestamp in seconds
        this.resultParams.accName = accName
    }

    async setAllExtraData() {
        await this.setContractParams();
        await this.setMetaData();
        await this.setResultParams();
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

    async getWalletAvailable() {
        let walletAvailable = 0
        let balance = await this.tokenContract.ft_balance_of(this.contract.wallet.getAccountId())
        walletAvailable = Number(convertToDecimals(balance, this.metaData.decimals, 5))
        return walletAvailable
    }
}