import { JsonRpcProvider } from "near-api-js/lib/providers"
import { nearConfig } from ".."

// let near: Near
// let wallet: WalletConnection
let provider: JsonRpcProvider 

export async function view(contractId: string, method: string, args?: any): Promise<any> {
    provider = new JsonRpcProvider(nearConfig.nodeUrl)
    const argsAsString = JSON.stringify(args)
    let argsBase64 = Buffer.from(argsAsString).toString("base64")
    console.log(argsBase64)
    // argsBase64 = "eyJhY2NvdW50X2lkIjogImVtcHR5X3Rlc3QudGVzdG5ldCJ9"
    const rawResult = await provider.query({
        request_type: "call_function",
        account_id: contractId,
        method_name: method,
        args_base64: argsBase64,
        finality: "optimistic",
      });
    
      // format result
      const res = JSON.parse(Buffer.from(rawResult.result).toString());
      return res
}