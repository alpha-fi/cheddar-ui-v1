import { ContractParams } from "../contracts/contract-structs";
import { FungibleTokenMetadata, NEP141Trait } from "../contracts/NEP141";
import { StakingPoolP1 } from "../contracts/p2-staking";
import { ntoy, toStringDec, yton } from "../util/conversions";
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
    // All the numbers that are strings are expected to be without any decimal points, and are converted when needed
    real_rewards_per_day: number = 0;
    skip: Number = 0;
    staked: string = "0";
    real: string = "0";
    // computed holds an integer number with no decimal places holding the info about the computed cheddar rewars calculated
    computed: string = "0";
    previous_real: string = "0";
    previous_timestamp: number = 0;
    tokenDecimals: Number = 0;
    accName: string = '';
    total_staked: Number = 0;

    getDisplayableComputed() {
        return toStringDec(yton(this.computed))
    }

    getCurrentCheddarRewards() {
        return yton(this.computed)
    }

    getDisplayableAccountName() {
        return this.accName.length > 22 ? this.accName.slice(0, 10) + ".." + this.accName.slice(-10) : this.accName
    }

    addStaked(amount: number) {
        this.staked = ntoy(yton(this.staked) + amount)
    }
}

export class PoolParams {
    html: HtmlPoolParams;
    contract: StakingPoolP1;
    contractParams: ContractParams;
    cheddarContract: NEP141Trait;
    tokenContract: NEP141Trait;
    metaData: FungibleTokenMetadata;
    resultParams: PoolResultParams;

    constructor(html: HtmlPoolParams, contract: StakingPoolP1, cheddarContract: NEP141Trait, tokenContract: NEP141Trait, resultParams: PoolResultParams, wallet: WalletInterface) {
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
    }

    async setAllExtraData() {
        await this.setContractParams();
        await this.setMetaData();
    }
}