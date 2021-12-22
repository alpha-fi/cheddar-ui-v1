import { ContractParams } from "../contracts/contract-structs";
import { FungibleTokenMetadata, NEP141Trait } from "../contracts/NEP141";
import { StakingPoolP1 } from "../contracts/p2-staking";
import { bigintToStringDecLong, convertToDecimals, ntoy, toStringDec, toStringDecLong, yton } from "../util/conversions";
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
    total_staked: bigint = 0n;

    getDisplayableComputed() {
        return bigintToStringDecLong(this.computed);
    }

    getCurrentCheddarRewards() {
        return yton(this.computed.toString())
    }

    getCurrentDisplayableCheddarRewards() {
        return bigintToStringDecLong(this.computed)
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
    html: HtmlPoolParams;
    contract: StakingPoolP1;
    contractParams: ContractParams;
    cheddarContract: NEP141Trait;
    tokenContract: NEP141Trait;
    metaData: FungibleTokenMetadata;
    resultParams: PoolResultParams;

    constructor(index: number, html: HtmlPoolParams, contract: StakingPoolP1, cheddarContract: NEP141Trait, tokenContract: NEP141Trait, resultParams: PoolResultParams, wallet: WalletInterface) {
        this.index = index;
        this.html = html;
        this.contract = contract;
        this.contractParams = new ContractParams();
        this.cheddarContract= cheddarContract;
        this.tokenContract = tokenContract;
        this.resultParams = resultParams;
        this.metaData = {} as FungibleTokenMetadata;

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
    }

    async setAllExtraData() {
        await this.setContractParams();
        await this.setMetaData();
    }

    setTotalRewardsPerDay() {
        const totalRewardsPerDay = BigInt(this.contractParams.farming_rate) * BigInt(60 * 24)
        const staked = this.resultParams.staked
        const totalStaked = this.resultParams.total_staked
        if(totalStaked > BigInt(0)) {
            this.resultParams.real_rewards_per_day = totalRewardsPerDay * (staked / totalStaked)
        } else {
            // I think in this case, the real_rewards_per_day should be 0, since there is nothing in the pool,
            // there is no reward for anyone.
            this.resultParams.real_rewards_per_day = totalRewardsPerDay
        }
        this.resultParams.previous_timestamp = Date.now()
    }

    setStatus(accountInfo: [string, string, string]) {
        this.resultParams.staked =  BigInt(accountInfo[0]);
        this.resultParams.real = BigInt(accountInfo[1]);
        this.resultParams.previous_timestamp = Number(accountInfo[2]) * 1000;
    }

    async getWalletAvailable() {
        const balance = await this.tokenContract.ft_balance_of(this.resultParams.accName)
        const walletAvailable = Number(convertToDecimals(balance, this.metaData.decimals, 5))
        return walletAvailable
    }
}