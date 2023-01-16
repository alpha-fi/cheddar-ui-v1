import { ENV } from "../config";
import { RefTokenData } from "../entities/refResponse";

let tokenDataArray: RefTokenData[]
let testTokensSymbols = ["afi-tt", "gua"]

async function setAllTokensData(): Promise<void> {
    const url = "https://api.stats.ref.finance/api/top-tokens"
    const response = await fetch(url)
    const errorMessage = "We are experiencing issues with the Ref Price Oracle, please try again in a bit."
    const json = await response.json()
    tokenDataArray = json
}

export async function getTokenData(token: string, reloadData: boolean = false): Promise<RefTokenData> {
    if(!tokenDataArray || reloadData) await setAllTokensData()
    return getPriceWithData(token)
}

function getPriceWithData(tokenSymbol: string): RefTokenData {
    tokenSymbol = tokenSymbol.toLowerCase()
    //@ts-ignore
    if(ENV == "testnet" && testTokensSymbols.includes(tokenSymbol)) {
        // AFI-TT doesn't exists in mainnet so this is a patch for testing purposes, selecting the token
        // PEM arbitrarily
        tokenSymbol = "pem".toLowerCase()
    }
    if(tokenSymbol == "near" || tokenSymbol == "nearcon") {
        tokenSymbol = "wnear"
    }
    let output: RefTokenData | undefined = undefined
    tokenDataArray.forEach(tokenData => {
        if(tokenData.symbol.toLowerCase() === tokenSymbol) {
            output = tokenData
        }
    });
    if(output !== undefined) {
        return output
    }
    throw Error(`Token with symbol ${tokenSymbol} not found`)
}

export async function getTokenDataArray(tokenArray: string[], reloadData: boolean = false): Promise< Map<string, RefTokenData> > {
    if(!tokenDataArray || reloadData) await setAllTokensData()
    // const allTokenData = await setAllTokensData()
    let output: Map<string, RefTokenData> = new Map()
    tokenArray.forEach(tokenSymbol => {
        tokenSymbol = tokenSymbol.toLowerCase()
        output.set(tokenSymbol, getPriceWithData(tokenSymbol))
    })
    return output
}