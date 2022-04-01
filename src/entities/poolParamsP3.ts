import { ContractParams } from "../contracts/contract-structs";
import { FungibleTokenMetadata, NEP141Trait } from "../contracts/NEP141";
import { StakingPoolP3 } from "../contracts/p3-staking";
import { P3ContractParams } from "../contracts/p3-structures";
import { bigintToStringDecLong, convertToDecimals, convertToBase, ntoy, toStringDec, toStringDecLong, yton } from "../util/conversions";
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
    real_rewards_per_day: bigint = 0n;
    skip: Number = 0;
    staked: bigint = 0n;
    real: bigint = 0n;
    // computed holds an integer number with no decimal places holding the info about the computed cheddar rewars calculated
    computed: bigint = 0n;
    previous_real: bigint = 0n;
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

    async setAllExtraData() {
        await this.setContractParams();
        await this.setMetaData();
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

        /*** Workaround Free Community Farm pool ***/

        /** TODO - make dynamic **/
        let walletAvailable = 0
        let walletAvailable2 = 0
        
        /** TODO - make dynamic **/
        let balance = await this.tokenContract.ft_balance_of(this.resultParams.accName)
        walletAvailable = Number(convertToDecimals(balance, this.metaData.decimals, 5))

        let balance2 = await this.cheddarContract.ft_balance_of(this.resultParams.accName)
        walletAvailable2 = Number(convertToDecimals(balance2, this.metaData2.decimals, 5))

        const walletBalances = [walletAvailable,walletAvailable2];   

        return walletBalances
        
        

        // if(this.contractParams.farming_rate) {
            

        // } else if(this.contractParams.farm_token_rates) {
            
        // }
        // else {
        //     let balance =  await this.contract.wallet.getAccountBalance()
        //     walletAvailable = Number(yton(balance))
        //     return walletAvailable
        // }


    }
}