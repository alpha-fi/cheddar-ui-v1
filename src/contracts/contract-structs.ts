import { transactions } from "near-api-js";
import { ntoy } from "../util/conversions";

type U128String = string;


//JSON compatible struct returned from get_contract_state
export class ContractParams {

    constructor() {
        this.rewards_per_day = this.farming_rate * 60n * 24n
    }

    accounts_registered: number = 0;
    owner_id: string = "";
    token_contract: string = "cheddar.token";
    // This value comes from the contract with (metadata.decimals - 5) decimals
    farming_rate: bigint = 10n; //yoctoCheddar per day per NEAR
    is_active: boolean = false;
    farming_start: number = 0; //unix timestamp
    farming_end: number = 0; //unix timestamp
    total_farmed: string = "0" //yoctoCheddar
    total_staked: string = "0" //yoctoNEAR
    // total_stake is needed for p1 contracts. It should only work for initial setting. On poolParams will be used to set total_staked so there shouldn't be any code differences
    total_stake: string = "0"
    // rewards_per_day is needed for p1 contracts. It should only work for initial setting. On poolParams will be used to set farming_rate so there shouldn't be any code differences
    rewards_per_day: bigint;
    // total_rewards is needed for p1 contracts. It should only work for initial setting. On poolParams will be used to set total_farmed so there shouldn't be any code differences
    total_rewards: string = "0"
    fee_rate: number = 0;   

    getRewardsPerDay(): bigint {
        return this.farming_rate * 60n * 24n
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

export interface StorageBalance {
    total: string
    available: string
}

export interface TransactionData {
    promise: Promise<transactions.Action>,
    contractName: string
}

