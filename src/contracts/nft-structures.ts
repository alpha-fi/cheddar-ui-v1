import { ntoy } from "../util/conversions";

type U128String = string;


//JSON compatible struct returned from get_contract_state
export class NFTStakingContractParams {

    constructor() {
        // this.rewards_per_day = this.farming_rate * 60n * 24n
    }

    is_active: boolean = false;
    owner_id: string = "";
    stake_tokens: string[] = [];
    stake_rates: U128String[] = [];
    farm_unit_emission: U128String = "";
    farm_tokens: string[] = [];
    farm_token_rates: U128String[] = [];
    farm_deposits: U128String[] = []
    farming_start: number = 0;
    farming_end: number = 0;
    cheddar_nft: string = ""
    total_staked: U128String[] = [];
    total_farmed: U128String[] = [];
    fee_rate: number = 0;
    accounts_registered: number = 0
    cheddar_rate: U128String = ""
    cheddar: string = ""

}

export class NFTStakingPoolUserStatus {
    // Amount of each token staked by user
    stake_tokens: U128String[] = [];
    stake: U128String = "";
    farmed_units: U128String = "";
    // Amount of each token in farm, waiting to be harvested
    farmed_tokens: U128String[] = [];
    cheddy_nft: string = "";
    timestamp: number = 0;
    total_cheddar_staked: U128String = ""

    // This constructor should only be used when user is not registered, hence userStatus is null
    constructor(stakeTokensLength: number = 0, farmTokensLength: number = 0) {
        this.stake_tokens = new Array(stakeTokensLength).fill("")
        this.farmed_tokens = new Array(stakeTokensLength).fill("")
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

export class TransferTokenData {
    contractName: string;
    amount: bigint;

    constructor(contractName: string, amount: bigint) {
        this.contractName = contractName
        this.amount = amount
    }
}