import { ntoy } from "../util/conversions";

type U128String = string;


//JSON compatible struct returned from get_contract_state
export class ContractParams {

    constructor() {
        this.rewards_per_day = this.farming_rate * 60n * 24n
    }

    owner_id: string = "";
    token_contract: string = "cheddar.token";
    // This value comes from the contract with (metadata.decimals - 5) decimals
    farming_rate: bigint = 10n; //yoctoCheddar per day per NEAR
    is_active: boolean = false;
    farming_start: number = 0; //unix timestamp
    farming_end: number = 0; //unix timestamp
    total_farmed: string = "0" //yoctoCheddar
    total_staked: string[] = [] //yoctoNEAR
    rewards_per_day: bigint;
    fee_rate: number = 0;

    getRewardsPerDay() {
        this.rewards_per_day = this.farming_rate * 60n * 24n
        return this.rewards_per_day
    }


}

export class TokenParams {
    decimals: string = "24";
    icon: string = "";
    name: string = "";
    reference: string = "";
    reference_hash: string = "";
    spec: string = "";
    symbol: string = "";
}


