import { ContractParams } from "../contracts/contract-structs";
import { FungibleTokenMetadata, NEP141Trait } from "../contracts/NEP141";
import { StakingPoolP1 } from "../contracts/p2-staking";
import { bigintToStringDecLong, convertToDecimals, convertToBase, ntoy, toStringDec, toStringDecLong, yton } from "../util/conversions";
import { WalletInterface } from "../wallet-api/wallet-interface";
import { RewardTokenIconData } from "./genericData";

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

    hasStakedTokens() {
        return this.staked > 0n
    }

    getDisplayableComputed() {
        return convertToDecimals(this.computed.toString(), 24, 7)
    }

    getCurrentCheddarRewards() {
        return convertToDecimals(this.real.toString(), 24, 7)
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

export class PoolParams {
    index: number
    type: string
    html: HtmlPoolParams;
    contract: StakingPoolP1;
    contractParams: ContractParams;
    cheddarContract: NEP141Trait;
    tokenContract: NEP141Trait;
    metaData: FungibleTokenMetadata;
    metaData2: FungibleTokenMetadata;
    resultParams: PoolResultParams;

    constructor(index: number, type:string, html: HtmlPoolParams, contract: StakingPoolP1, cheddarContract: NEP141Trait, tokenContract: NEP141Trait, resultParams: PoolResultParams, wallet: WalletInterface) {
        this.index = index;
        this.type = type;
        this.html = html;
        this.contract = contract;
        this.contractParams = new ContractParams();
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
        let accountInfo = await this.contract.status(accName)

        this.resultParams.staked = BigInt(accountInfo[0])
        this.resultParams.real = BigInt(accountInfo[1])
        this.resultParams.previous_real = BigInt(accountInfo[1])
        this.resultParams.computed = BigInt(accountInfo[1])
        this.resultParams.previous_timestamp = Number(accountInfo[2])
        // Contract saves previous_timestamp in seconds
        this.resultParams.previous_timestamp = Date.now() / 1000
        this.resultParams.accName = accName
    }

    async setAllExtraData() {
        await this.setContractParams();
        await this.setMetaData();
        await this.setResultParams();
    }

    async getRewardTokenIconData(): Promise<RewardTokenIconData[]> {
        const cheddarMetaData = await this.cheddarContract.ft_metadata()
        const src = cheddarMetaData.icon ? cheddarMetaData.icon : cheddarMetaData.name
        return [{
            isSvg: src.includes("<svg"),
            src: src,
            alt: cheddarMetaData.name 
        }]
    }

    setTotalRewardsPerDay() {


        /*** Workaround Free Community Farm pool ***/
        let totalRewardsPerDay = 0n
        let totalStaked = 0n

       
        totalRewardsPerDay = BigInt(this.contractParams.farming_rate) * BigInt(60 * 24)
        totalStaked = BigInt(this.contractParams.total_staked)
        
        //  QUESTION What is this for? (Used to be an else)
        // else {
        //     totalRewardsPerDay = BigInt(this.contractParams.rewards_per_day)
        //     totalStaked = BigInt(this.contractParams.total_stake)
        // }

        // const staked = this.resultParams.staked


        if(totalStaked > BigInt(0)) {

            /*** Workaround Free Community Farm pool ***/

            if(this.contractParams.farming_rate) {

                /** TODO - Rewrite  **/
                // QUESTION How to rewrite? So it doesn't throw any errors?
                // let rewardsPerDay = BigInt(yton(totalRewardsPerDay)) * (BigInt(convertToDecimals(staked, this.metaData.decimals, 10)) / BigInt(convertToDecimals(totalStaked, this.metaData.decimals, 10)))
                
                // this.resultParams.real_rewards_per_day = BigInt(convertToBase(rewardsPerDay.toString(), "24"))

                // console.log("Total Rewards Per Day ", yton(totalRewardsPerDay))
                // console.log("Staked: ", convertToDecimals(staked, this.metaData.decimals, 10))
                // console.log("Total Staked: ", convertToDecimals(totalStaked, this.metaData.decimals, 10))
                // console.log("Fraction of Stake ", convertToDecimals(staked, this.metaData.decimals, 10) / convertToDecimals(totalStaked, this.metaData.decimals, 10))
                // console.log("Rewards Per Day ", yton(totalRewardsPerDay) * (convertToDecimals(staked, this.metaData.decimals, 10) / convertToDecimals(totalStaked, this.metaData.decimals, 10)))
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
        this.resultParams.staked = BigInt(accountInfo[0]);
        this.resultParams.real = BigInt(accountInfo[1])
        this.resultParams.previous_timestamp = Number(accountInfo[2])            
    }

    async getWalletAvailable() {
        return await this.tokenContract.ft_balance_of(this.contract.wallet.getAccountId())
    }

    async getWalletAvailableDisplayable() {
        const available = await this.getWalletAvailable()
        return convertToDecimals(available, this.metaData.decimals, 7)
    }
}