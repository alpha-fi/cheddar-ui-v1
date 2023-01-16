export interface NFT {
    token_id: string
    owner_id: string
    metadata: NFTMetadata
    approved_account_ids: object
}

export interface NFTWithMetadata extends NFT {
    contract_id: string
    base_url: string
}

export interface NFTMetadata {
    spec: string
    name: string
    symbol: string
    icon: string
    base_uri: string
    reference: string|null
    reference_hash: string|null
}

export function newNFT(tokenId: string, baseUrl: string, contractId: string): NFTWithMetadata {
    return {
        contract_id: contractId,
        base_url: baseUrl,
        token_id: tokenId,
        owner_id: "",
        metadata: {
            title: "",
            description: "",
            media: tokenId + ".png",
            media_hash: "",
            copies: null,
            issued_at: "",
            expires_at: "",
            starts_at: "",
            updated_at: "",
            extra: "",
            reference: "",
            reference_hash: ""
        },
        approved_account_ids: {}
    }
}