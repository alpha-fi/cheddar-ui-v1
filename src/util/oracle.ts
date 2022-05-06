import { ENV } from "../config";
import { RefTokenData } from "../entities/refResponse";

async function getAllTokensData(): Promise<RefTokenData[]> {
    const url = "https://api.stats.ref.finance/api/top-tokens"
    return (await fetch(url)).json()
}

export async function getPrice(token: string): Promise<RefTokenData> {
    const allTokenData = await getAllTokensData()
    return getPriceWithData(token, allTokenData)
}

function getPriceWithData(tokenSymbol: string, allTokenData: RefTokenData[]): RefTokenData {
    tokenSymbol = tokenSymbol.toLowerCase()
    if(ENV == "testnet" && tokenSymbol == "afi-tt") {
        // AFI-TT doesn't exists in mainnet so this is a patch for testing purposes, selecting the token
        // NUT arbitrarily
        tokenSymbol = "nut".toLowerCase()
    }
    let output: RefTokenData | undefined = undefined
    allTokenData.forEach(tokenData => {
        if(tokenData.symbol.toLowerCase() === tokenSymbol) {
            output = tokenData
        }
    });
    if(output !== undefined) {
        return output
    }
    throw Error(`Token with symbol ${tokenSymbol} not found`)
}

export async function getPrices(tokenArray: string[]): Promise< Map<string, RefTokenData> > {
    const allTokenData = await getAllTokensData()
    let output: Map<string, RefTokenData> = new Map()
    tokenArray.forEach(tokenSymbol => {
        tokenSymbol = tokenSymbol.toLowerCase()
        output.set(tokenSymbol, getPriceWithData(tokenSymbol, allTokenData))
    })
    return output
}