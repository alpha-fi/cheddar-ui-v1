type U128String = string;


//JSON compatible struct returned from get_contract_state
export type ContractParams = {
    owner_id:string,
    token_contract:string,
    rewards_per_year: number,
    is_open:boolean
}

