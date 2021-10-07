type U128String = string;


//JSON compatible struct returned from get_contract_state
export type ContractParams = {
    owner_id: string,
    token_contract: string,
    farming_rate: string, //yoctoCheddar per day per NEAR
    is_active: boolean,
    farming_start: number, //unix timestamp
    farming_end: number, //unix timestamp
    total_farmed: string, //yoctoCheddar
    total_staked: string, //yoctoNEAR
}

export type TokenParams = {
    decimals: string,
    icon: string,
    name: string,
    reference: string,
    reference_hash: string,
    spec: string,
    symbol: string,
}


