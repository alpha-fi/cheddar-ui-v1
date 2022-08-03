import {NO_CONTRACT_DEPOSIT_NEAR} from '../config';
import {getNearMetadata} from '../contracts/nearHardcodedObjects';
import {FungibleTokenMetadata, NEP141Trait} from '../contracts/NEP141';
import { NFT } from '../contracts/nft-structs';
import { NFTContract } from '../contracts/NFTContract';
import {disconnectedWallet} from '../wallet-api/disconnected-wallet';
import {U128String} from '../wallet-api/util';
import {WalletInterface} from '../wallet-api/wallet-interface';
import {getTokenContractList, TokenContractData} from './PoolEntities';
import {StakingPoolNFT} from '../contracts/nft-staking';
import {NFTStakingContractParams} from '../contracts/nft-structures';
import {P3ContractParams, PoolUserStatus as UserStatusP3} from '../contracts/p3-structures';


async function getNFTContractList(wallet:WalletInterface, contractNameArray: string[], nftBaseUrl: string): Promise<NFTContractData[]> {
    let NFTContractList = []
    for(let i = 0; i < contractNameArray.length; i++) {
        const NFTContractName = contractNameArray[i]
        NFTContractList.push(new NFTContractData(wallet, NFTContractName, nftBaseUrl, ""))
    }
    return NFTContractList
}


export class StakingContractDataNFT {
    // Contract to which one staked and unstakes
    contract: StakingPoolNFT
    // Staking contract parameters
    // @ts-ignore
    private contractParamsPromise: Promise<NFTStakingContractParams>
    // User parameters of staking contract
    // @ts-ignore
    private userStatusPromise: Promise<UserStatusP3>
    // List of tokens accepted by staking contract 
    private stakeTokenContractListPromise: Promise<TokenContractData[]>
    private stakeNFTContractListPromise: Promise<NFTContractData[]>
    private contractParams: NFTStakingContractParams | undefined
    private userStatus: UserStatusP3 | undefined
    private stakeTokenContractList: TokenContractData[] = [];
    private stakeNFTContractList: NFTContractData[] = [];
    private farmTokenContractList: TokenContractData[] = [];

    constructor(wallet: WalletInterface, contractId: string, nftBaseUrl: string) {
        this.contract = new StakingPoolNFT(contractId)
        this.contract.wallet = wallet
        this.refreshData()
        this.stakeTokenContractListPromise = this.getStakeTokenContractListPromise()
        this.stakeNFTContractListPromise = this.getStakeNFTContractListPromise(nftBaseUrl)
    }

    refreshData() {
        this.contractParamsPromise = this.contract.get_contract_params()
        this.userStatusPromise = this.contract.status()
        this.contractParams = undefined
        this.userStatus = undefined
    }

    async getContractParams(): Promise<NFTStakingContractParams> {
        if(this.contractParams === undefined) {
            this.contractParams = await this.contractParamsPromise
        }
        return this.contractParams
    }

    getContractParamsNotAsync(): P3ContractParams {
        return this.contractParams!
    }

    async getUserStatus(): Promise<UserStatusP3> {
        if(this.userStatus === undefined) {
            this.userStatus = await this.userStatusPromise
            if(this.userStatus == null) { // When user is not registered, user status is null
                const contractParams = await this.getContractParams()
                // There is always only one staked token in this case that is cheddar (besides the NFT)
                this.userStatus = new UserStatusP3(1, contractParams.farm_tokens.length)
            }
        }
        return this.userStatus
    }

    private async getStakeTokenContractListPromise(): Promise<TokenContractData[]> {
        const contractParams = await this.getContractParams();
        // On NFT staking contract, cheddar is always the staked token, besides the NFT's
        return getTokenContractList(this.contract.wallet, [contractParams.cheddar])
    }

    private async getStakeNFTContractListPromise(nftBaseUrl: string): Promise<NFTContractData[]> {
        const contractParams = await this.getContractParams();
        // On NFT staking contract, cheddar is always the staked token, besides the NFT's
        return getNFTContractList(this.contract.wallet, contractParams.stake_tokens, nftBaseUrl)
    }

    async getStakeTokenContractList(): Promise<TokenContractData[]> {
        if(this.stakeTokenContractList.length == 0) {
            this.stakeTokenContractList = await this.stakeTokenContractListPromise as TokenContractData[]
            // const contractParams = await this.getContractParams();
            // this.stakeTokenContractList = await getTokenContractList(this.contract.wallet, contractParams.stake_tokens)
        }
        return this.stakeTokenContractList
    }

    async getFarmTokenContractList(): Promise<TokenContractData[]> {
        if(this.farmTokenContractList.length == 0) {
            const contractParams = await this.getContractParams();
            this.farmTokenContractList = await getTokenContractList(this.contract.wallet, contractParams.farm_tokens)
        }
        return this.farmTokenContractList
    }        

    async getStakeNFTContractList(): Promise<NFTContractData[]> {
        if(this.stakeNFTContractList.length == 0) {
            this.stakeNFTContractList = await this.stakeNFTContractListPromise as NFTContractData[]
            // const contractParams = await this.getContractParams();
            // this.stakeTokenContractList = await getTokenContractList(this.contract.wallet, contractParams.stake_tokens)
        }
        return this.stakeNFTContractList
    }
}


export class NFTContractData {
    contract: NFTContract
    wallet: WalletInterface
    private tokensForOwnerPromise: Promise<NFT[]> | undefined
    // private balancePromise: Promise<U128String> | undefined
    private tokensForOwner: NFT[] | undefined
    // private balance: U128String | undefined

    constructor(wallet: WalletInterface, contractId: string, nftBaseUrl: string, poolName: string = "") {
        this.wallet = wallet
        
        this.contract = new NFTContract(contractId, nftBaseUrl!)
        this.contract.wallet = wallet
        this.tokensForOwnerPromise = this.contract.nft_tokens_for_owner(wallet.getAccountId())
        // this.balancePromise = this.contract.ft_balance_of(wallet.getAccountId())
        
    }

    async getTokensForOwner(): Promise<NFT[]> {
        if(!this.tokensForOwner) {
            this.tokensForOwner = await this.tokensForOwnerPromise           
        }
        return this.tokensForOwner!
    }

    getTokensForOwnerSync(): NFT[] {
        return this.tokensForOwner!
    }

    refreshData() {
        this.tokensForOwner = undefined
        
        this.tokensForOwnerPromise = this.contract.nft_tokens_for_owner(this.wallet.getAccountId())
        
    }
}