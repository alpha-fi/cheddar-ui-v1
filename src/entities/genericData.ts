export interface RewardTokenIconData {
    isSvg: boolean
    src: string
    alt: string
}

export interface UnclaimedRewardsData {
    amount: string
    iconData: RewardTokenIconData
}

export interface HTMLTokenInputData {
    htmlInputArray: HTMLInputElement[]
    amountValuesArray: bigint[]
    transferedAmountWithSymbolArray: string[]
}