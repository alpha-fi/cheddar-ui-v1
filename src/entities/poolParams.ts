import { wallet } from "..";
import { ContractParams } from "../contracts/contract-structs";
import { FungibleTokenMetadata, NEP141Trait } from "../contracts/NEP141";
import { StakingPoolP1 } from "../contracts/p2-staking";
import { bigintToStringDecLong, convertToDecimals, convertToBase, ntoy, toStringDec, toStringDecLong, yton } from "../util/conversions";
import { WalletInterface } from "../wallet-api/wallet-interface";
import { DetailRow, RewardsTokenData, TokenIconData, UnclaimedRewardsData } from "./genericData";
import { ContractData } from "./poolParamsP3";

//JSON compatible struct returned from get_contract_state
export class HtmlPoolParams {
    id: string;
    formId: string;

    constructor(id: string) {
        this.id = id+"-container";
        this.formId = id;
    }
}

export class PoolResultParams {
    // All the numbers that are bigint are expected to be without any decimal points, and are converted when needed
    real_rewards_per_day: bigint = 0n;
    skip: Number = 0;
    staked: bigint = 0n;
    real: bigint = 0n;
    // computed holds an integer number with no decimal places holding the info about the computed cheddar rewars calculated
    computed: bigint = 0n;
    previous_real: bigint = 0n;
    previous_timestamp: number = 0;
    tokenDecimals: Number = 0;
    accName: string = '';

    hasStakedTokens() {
        return this.staked > 0n
    }

    getDisplayableComputed() {
        return convertToDecimals(this.computed.toString(), 24, 7)
    }

    getCurrentCheddarRewards() {
        return convertToDecimals(this.real.toString(), 24, 7)
    }

    getCurrentDisplayableCheddarRewards() {
        return convertToDecimals(this.computed.toString(), 24, 7)
    }

    getDisplayableAccountName() {
        return this.accName.length > 22 ? this.accName.slice(0, 10) + ".." + this.accName.slice(-10) : this.accName
    }

    addStaked(amount: string) {
        this.staked = this.staked + BigInt(amount)
    }
}

export class PoolParams {
    wallet: WalletInterface
    index: number
    type: string
    html: HtmlPoolParams;
    // Contract called to move the tokens
    stakingContract: StakingPoolP1;
    // Staking contract metadata
    stakingContractMetaData: FungibleTokenMetadata;
    // Current state of the staking contract
    contractParams: ContractParams;
    // Current state of user in staking contract
    resultParams: PoolResultParams;
    // Cheddar contract
    cheddarContract: NEP141Trait;
    // Token to be staked contract
    stakeTokenContract: NEP141Trait;
    // Not used - remove
    metaData2: FungibleTokenMetadata;
    stakeTokenContractList: ContractData[] = [];
    farmTokenContractList: ContractData[] = [];

    constructor(index: number, type:string, html: HtmlPoolParams, contract: StakingPoolP1, cheddarContract: NEP141Trait, tokenContract: NEP141Trait, resultParams: PoolResultParams, wallet: WalletInterface) {
        this.wallet = wallet
        this.index = index;
        this.type = type;
        this.html = html;
        this.stakingContract = contract;
        this.contractParams = new ContractParams();
        this.cheddarContract= cheddarContract;
        this.stakeTokenContract = tokenContract;
        this.resultParams = resultParams;
        this.stakingContractMetaData = {} as FungibleTokenMetadata;
        this.metaData2 = {} as FungibleTokenMetadata;

        this.stakingContract.wallet = wallet;
        this.cheddarContract.wallet = wallet;
        this.stakeTokenContract.wallet = wallet;
    }

    async getTokenContractList(tokenContractName: string): Promise<ContractData[]> {
        let tokenContractList = []
        let contract = new NEP141Trait(tokenContractName)
        contract.wallet = this.wallet
        let metaData = await contract.ft_metadata()
        if(metaData.symbol == "STNEAR") {
            metaData.symbol = "stNEAR";
        }
        tokenContractList.push({
            contract,
            metaData,
            balance: await contract.ft_balance_of(this.wallet.getAccountId())
        })
        return tokenContractList
    }

    getPoolName() {
        return this.stakeTokenContractList[0].metaData.symbol
    }

    async setStakeTokenContractList() {
        this.stakeTokenContractList = await this.getTokenContractList(this.stakeTokenContract.contractId)
    }

    async setFarmTokenContractList() {
        this.farmTokenContractList = await this.getTokenContractList(this.cheddarContract.contractId)
    }

    async setContractParams() {
        this.contractParams = await this.stakingContract.get_contract_params();
    }

    async setMetaData() {
        this.stakingContractMetaData = await this.stakeTokenContract.ft_metadata()
        if(this.stakingContractMetaData.symbol == "STNEAR") {
            this.stakingContractMetaData.symbol = "stNEAR";
        }

        this.metaData2 = await this.cheddarContract.ft_metadata()
    }

    async setResultParams() {
        const accName = this.stakingContract.wallet.getAccountId()
        let accountInfo = await this.stakingContract.status(accName)

        this.resultParams.staked = BigInt(accountInfo[0])
        this.resultParams.real = BigInt(accountInfo[1])
        this.resultParams.previous_real = BigInt(accountInfo[1])
        this.resultParams.computed = BigInt(accountInfo[1])
        this.resultParams.previous_timestamp = Number(accountInfo[2])
        // Contract saves previous_timestamp in seconds
        this.resultParams.previous_timestamp = Date.now() / 1000
        this.resultParams.accName = accName
    }

    async setAllExtraData() {
        await this.setContractParams();
        await this.setStakeTokenContractList()
        await this.setFarmTokenContractList()
        await this.setMetaData();
        await this.setResultParams();
    }

    async refreshAllExtraData() {
        await this.setContractParams()
        await this.setResultParams()
        await this.setStakeTokenContractList()
    }
    
    getStakedTokenIconData(): TokenIconData[] {
        
        const stakeTokenContract = this.stakeTokenContractList[0]
        const src = stakeTokenContract.metaData.icon ? stakeTokenContract.metaData.icon : stakeTokenContract.metaData.name
        return [{
            isSvg: src.includes("<svg"),
            src: src,
            tokenName: stakeTokenContract.metaData.name ? stakeTokenContract.metaData.name : "NoName"
        }]
    }

    async getRewardTokenIconData(): Promise<TokenIconData[]> {
        const cheddarMetaData = await this.cheddarContract.ft_metadata()
        const src = cheddarMetaData.icon ? cheddarMetaData.icon : cheddarMetaData.name
        return [{
            isSvg: src.includes("<svg"),
            src: src,
            tokenName: cheddarMetaData.name 
        }]
    }

    getStakeTokensDetail(): DetailRow[]{
        let dataArray: DetailRow[] = []
        
        const stakeTokenContract = this.stakeTokenContractList[0]
        const iconData = this.getIcon(stakeTokenContract)
        const totalStaked = convertToDecimals(this.contractParams.total_staked, stakeTokenContract.metaData.decimals, 5)

        dataArray.push({
            iconData,
            content: totalStaked
        })
        
        return dataArray
    }

    getRewardsTokenDetail(): RewardsTokenData[] {
        let dataArray: RewardsTokenData[] = []

        const farmTokenContract = this.farmTokenContractList[0]
        const iconData = this.getIcon(farmTokenContract)
        const tokenName = farmTokenContract.metaData.name
        const rewardsPerDayBN = BigInt(this.contractParams.farming_rate) * 60n * 24n
        const rewardsPerDay = convertToDecimals(rewardsPerDayBN, farmTokenContract.metaData.decimals, 7)
        const totalRewards = convertToDecimals(this.contractParams.total_farmed, farmTokenContract.metaData.decimals, 7)
        const userUnclaimedRewards = convertToDecimals(this.resultParams.real.toString(), farmTokenContract.metaData.decimals, 7)
        
        dataArray.push({
            iconData,
            tokenName,
            rewardsPerDay,
            totalRewards,
            userUnclaimedRewards,
        })
        
        return dataArray
    }

    getIcon(contractData: ContractData): TokenIconData{
        const src = contractData.metaData.icon ? contractData.metaData.icon : contractData.metaData.name
        return {
            isSvg: src.includes("<svg"),
            src: src,
            tokenName: contractData.metaData.name ? contractData.metaData.name : "NoName"
        }
    }

    async getUnclaimedRewardsData(): Promise<UnclaimedRewardsData[]> {
        const amount = this.resultParams.getCurrentCheddarRewards()
        const rewardTokenIconData = await this.getRewardTokenIconData()
        return [{
            amount: amount,
            iconData: rewardTokenIconData[0]
        }]
    }

    async getStakeTokenContractData(): Promise<ContractData> {
        return {
            contract: this.stakeTokenContract,
            metaData: await this.stakeTokenContract.ft_metadata(),
            balance: await this.stakeTokenContract.ft_balance_of(wallet.getAccountId()),
        }
    }

    async getFarmTokenContractData(): Promise<ContractData> {
        const metadata = await this.cheddarContract.ft_metadata()
        return {
            contract: this.cheddarContract,
            metaData: metadata,
            balance: await this.cheddarContract.ft_balance_of(wallet.getAccountId()),
        }
    }

    setStatus(accountInfo: [string, string, string]) {
        this.resultParams.staked = BigInt(accountInfo[0]);
        this.resultParams.real = BigInt(accountInfo[1])
        this.resultParams.previous_timestamp = Number(accountInfo[2])            
    }

    async getWalletAvailable() {
        return await this.stakeTokenContract.ft_balance_of(this.stakingContract.wallet.getAccountId())
    }

    async getWalletAvailableDisplayable() {
        const available = await this.getWalletAvailable()
        return convertToDecimals(available, this.stakingContractMetaData.decimals, 7)
    }
}