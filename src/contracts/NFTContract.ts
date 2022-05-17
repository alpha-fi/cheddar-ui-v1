//JSON compatible struct ft_metadata
import {SmartContract} from "../wallet-api/base-smart-contract"
import * as nearAPI from "near-api-js"

import {ntoy, TGas} from "../util/conversions"
import { BN } from "bn.js";
import { NFT } from "./nft-structs";

type U128String = string;
type U64String = string;

export const nftBaseUrl = "https://bafybeibghcllcmurku7lxyg4wgxn2zsu5qqk7h4r6bmyhpztmyd564cx54.ipfs.nftstorage.link/"

export class NFTContract extends SmartContract {

    async withdraw_nft(receiver_id:string):Promise<void>{
        return this.call("withdraw_nft",{receiver_id:receiver_id},TGas(200),"1"); //one-yocto attached
    }

    async nft_transfer_call(receiver_id:string, token_id:U128String):Promise<any>{
        return this.call("nft_transfer_call",{receiver_id:receiver_id, token_id:token_id, msg:"to boost"},TGas(200),"1"); //one-yocto attached
    }

    async nft_tokens_for_owner(accountId:string) : Promise<NFT[]> {
        return this.view("nft_tokens_for_owner", {account_id: accountId})
    }

    async ft_balance_of(accountId:string) : Promise<U128String> {
        return this.view("ft_balance_of",{account_id:accountId }) 
    }

}