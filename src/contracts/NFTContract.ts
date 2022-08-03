//JSON compatible struct ft_metadata
import {SmartContract} from "../wallet-api/base-smart-contract"
import * as nearAPI from "near-api-js"

import {ntoy, TGas} from "../util/conversions"
import { NFT } from "./nft-structs";

type U128String = string;
type U64String = string;

// export const nftBaseUrl = "https://nftstorage.link/ipfs/bafybeicoln5rvccttgypzo26irjlskslnfynkzig6bowpsj6ay45geeice/"

export class NFTContract extends SmartContract {
    
    constructor( 
        public contractId:string,
        public baseUrl: string
    )
    {
        super(contractId)
        // console.log("DBase url", this.baseUrl)
    }

    async nft_transfer_call(receiver_id:string, token_id:U128String):Promise<any>{
        return this.call("nft_transfer_call",{receiver_id:receiver_id, token_id:token_id, msg:"to boost"},TGas(200),"1"); //one-yocto attached
    }

    async nft_tokens_for_owner(accountId:string) : Promise<NFT[]> {
        return this.view("nft_tokens_for_owner", {account_id: accountId})
    }

    // async ft_balance_of(accountId:string) : Promise<U128String> {
    //     return this.view("ft_balance_of",{account_id:accountId }) 
    // }

}