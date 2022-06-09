import { ENV } from "../config";
import { RefTokenData } from "../entities/refResponse";

let tokenArray: RefTokenData[]

async function setAllTokensData(): Promise<void> {
    const url = "https://api.stats.ref.finance/api/top-tokens"
    const response = await fetch(url)
    const json = await response.json()
    tokenArray = json
}

export async function getPrice(token: string, reloadData: boolean = false): Promise<RefTokenData> {
    if(!tokenArray || reloadData) await setAllTokensData()
    return getPriceWithData(token)
}

function getPriceWithData(tokenSymbol: string): RefTokenData {
    tokenSymbol = tokenSymbol.toLowerCase()
    if(ENV == "testnet" && tokenSymbol == "afi-tt") {
        // AFI-TT doesn't exists in mainnet so this is a patch for testing purposes, selecting the token
        // NUT arbitrarily
        tokenSymbol = "nut".toLowerCase()
    }
    if(tokenSymbol == "near" || tokenSymbol == "nearcon") {
        tokenSymbol = "wnear"
    }
    let output: RefTokenData | undefined = undefined
    tokenArray.forEach(tokenData => {
        if(tokenData.symbol.toLowerCase() === tokenSymbol) {
            output = tokenData
        }
    });
    if(output !== undefined) {
        return output
    }
    throw Error(`Token with symbol ${tokenSymbol} not found`)
}

export async function getPrices(tokenArray: string[], reloadData: boolean = false): Promise< Map<string, RefTokenData> > {
    if(!tokenArray || reloadData) await setAllTokensData()
    // const allTokenData = await setAllTokensData()
    let output: Map<string, RefTokenData> = new Map()
    tokenArray.forEach(tokenSymbol => {
        tokenSymbol = tokenSymbol.toLowerCase()
        output.set(tokenSymbol, getPriceWithData(tokenSymbol))
    })
    return output
}