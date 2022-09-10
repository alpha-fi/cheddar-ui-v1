import { U128String } from "../wallet-api/util"

export interface TokenIconData {
    isSvg: boolean
    src: string
    tokenName: string
}

export interface UnclaimedRewardsData {
    amount: string
    iconData: TokenIconData
}

export interface HTMLTokenInputData {
    htmlInputArray: HTMLInputElement[]
    amountValuesArray: bigint[]
    transferedAmountWithSymbolArray: string[]
}

export interface DetailRowElements {
	parentClass: string,
	// genericItemClass: string,
	rows: DetailRow[]
}

export interface DetailRow {
	iconData: TokenIconData,
	content: string
}

export interface RewardsTokenData {
    iconData: TokenIconData
    tokenName: string
    rewardsPerDayBN: bigint|undefined
    rewardsPerDay: string
    totalRewards: string
    userUnclaimedRewards: string
}