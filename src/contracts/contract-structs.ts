type U128String = string;


//JSON compatible struct returned from get_contract_state
export type ContractParams = {
    owner_id: string,
    token_contract: string,
    rewards_per_day: string, //yoctoCheddar per day per NEAR
    is_active: boolean,
    farming_start: number, //unix timestamp
    farming_end: number, //unix timestamp
    total_rewards: string, //yoctoCheddar
    total_staked: string, //yoctoNEAR
}

