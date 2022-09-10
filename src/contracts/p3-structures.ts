import { ntoy } from "../util/conversions";

type U128String = string;


//JSON compatible struct returned from get_contract_state
export class P3ContractParams {

    constructor() {
        // this.rewards_per_day = this.farming_rate * 60n * 24n
    }

    owner_id: string = "";
    stake_tokens: string[] = [];
    stake_rates: U128String[] = [];
    farm_unit_emission: U128String = "";
    farm_tokens: string[] = [];
    farm_token_rates: U128String[] = [];
    is_active: boolean = false;
    farming_start: number = 0;
    farming_end: number = 0;
    total_staked: U128String[] = [];
    total_farmed: U128String[] = [];
    fee_rate: number = 0;
    accounts_registered: number = 0;

}

export class PoolUserStatusP3 {
    // Amount of each token staked by user
    stake_tokens: U128String[] = [];
    stake: U128String = "";
    farmed_units: U128String = "";
    // Amount of each token in farm, waiting to be harvested
    farmed_tokens: U128String[] = [];
    cheddy_nft: string = "";
    timestamp: number = 0;

    // This constructor should only be used when user is not registered, hence userStatus is null
    constructor(stakeTokensLength: number = 0, farmTokensLength: number = 0) {
        this.stake_tokens = new Array(stakeTokensLength).fill("0")
        this.farmed_tokens = new Array(farmTokensLength).fill("0")
    }
}

export class PoolUserStatusP3NFT {
    // Amount of each token staked by user
    stake_tokens: string[][] = [];
    stake: U128String = "";
    farmed_units: U128String = "";
    // Amount of each token in farm, waiting to be harvested
    farmed_tokens: U128String[] = [];
    boost_nfts: string = ""
    timestamp: number = 0;

    // This constructor should only be used when user is not registered, hence userStatus is null
    constructor(stakeTokensLength: number = 0, farmTokensLength: number = 0) {
        this.stake_tokens = new Array(stakeTokensLength).fill([])
        this.farmed_tokens = new Array(farmTokensLength).fill("0")
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