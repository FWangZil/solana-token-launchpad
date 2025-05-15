import { Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import {
  TOKEN_2022_PROGRAM_ID,
  createMintToInstruction,
  createAssociatedTokenAccountInstruction,
  getMintLen,
  createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction,
  TYPE_SIZE,
  LENGTH_SIZE,
  ExtensionType,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { createInitializeInstruction, pack } from "@solana/spl-token-metadata";

export function TokenLaunchpad() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokenImage, setTokenImage] = useState("");
  const [initialSupply, setInitialSupply] = useState("");
  const [notification, setNotification] = useState({
    show: false,
    message: "",
  });
  const [mintAddress, setMintAddress] = useState("");

  async function createToken() {
    if (
      !tokenName ||
      !tokenSymbol ||
      !tokenImage ||
      !initialSupply
    ) {
      setNotification({ show: true, message: "Please fill in all fields" });
      setTimeout(() => setNotification({ show: false, message: "" }), 3000);
      return;
    }

    const mintKeypair = Keypair.generate();
    const metadata = {
      mint: mintKeypair.publicKey,
      name: tokenName,
      symbol: tokenSymbol.padEnd(10).slice(0, 10),
      uri: tokenImage,
      additionalMetadata: [],
    };

    const mintLen = getMintLen([ExtensionType.MetadataPointer]);
    const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;

    const lamports = await connection.getMinimumBalanceForRentExemption(
      mintLen + metadataLen
    );

    try {
      const transaction = new Transaction().add(
        SystemProgram.createAccount({
          fromPubkey: wallet.publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          space: mintLen,
          lamports,
          programId: TOKEN_2022_PROGRAM_ID,
        }),
        createInitializeMetadataPointerInstruction(
          mintKeypair.publicKey,
          wallet.publicKey,
          mintKeypair.publicKey,
          TOKEN_2022_PROGRAM_ID
        ),
        createInitializeMintInstruction(
          mintKeypair.publicKey,
          9,
          wallet.publicKey,
          null,
          TOKEN_2022_PROGRAM_ID
        ),
        createInitializeInstruction({
          programId: TOKEN_2022_PROGRAM_ID,
          mint: mintKeypair.publicKey,
          metadata: mintKeypair.publicKey,
          name: metadata.name,
          symbol: metadata.symbol,
          uri: metadata.uri,
          mintAuthority: wallet.publicKey,
          updateAuthority: wallet.publicKey,
        })
      );

      transaction.feePayer = wallet.publicKey;
      transaction.recentBlockhash = (
        await connection.getLatestBlockhash()
      ).blockhash;
      transaction.partialSign(mintKeypair);

      await wallet.sendTransaction(transaction, connection);

      const associatedToken = getAssociatedTokenAddressSync(
        mintKeypair.publicKey,
        wallet.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      const transaction2 = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          associatedToken,
          wallet.publicKey,
          mintKeypair.publicKey,
          TOKEN_2022_PROGRAM_ID
        )
      );

      await wallet.sendTransaction(transaction2, connection);

      const supplyAmount = parseInt(initialSupply) * 10 ** 9; // Convert to smallest units with 9 decimals
      const transaction3 = new Transaction().add(
        createMintToInstruction(
          mintKeypair.publicKey,
          associatedToken,
          wallet.publicKey,
          supplyAmount,
          [],
          TOKEN_2022_PROGRAM_ID
        )
      );

      await wallet.sendTransaction(transaction3, connection);

      setNotification({
        show: true,
        message: `Successfully created token ${tokenName} (${tokenSymbol})!`,
      });
      setMintAddress(mintKeypair.publicKey.toBase58()); // Store Mint address after successful transaction
      setTimeout(() => setNotification({ show: false, message: "" }), 5000);

      // Reset form
      setTokenName("");
      setTokenSymbol("");
      setTokenImage("");
      setInitialSupply("");
    } catch (error) {
      console.error("Error creating token:", error);
      setNotification({
        show: true,
        message: `Error: ${error.message}`,
      });
      setTimeout(() => setNotification({ show: false, message: "" }), 5000);
    }
  }

  return (
    <>
      <div className="launchpad-container">
        <div className="launchpad-card">
          <h1>Solana Token Launchpad</h1>

          <div className="input-group">
            <input
              className="inputText"
              type="text"
              placeholder=" "
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
            />
            <label className="input-label">Token Name</label>
          </div>

          <div className="input-group">
            <input
              className="inputText"
              type="text"
              placeholder=" "
              value={tokenSymbol}
              onChange={(e) => setTokenSymbol(e.target.value)}
            />
            <label className="input-label">Token Symbol</label>
          </div>

          <div className="input-group">
            <input
              className="inputText"
              type="text"
              placeholder=" "
              value={tokenImage}
              onChange={(e) => setTokenImage(e.target.value)}
            />
            <label className="input-label">Metadata URL</label>
          </div>

          <div className="input-group">
            <input
              className="inputText"
              type="text"
              placeholder=" "
              value={initialSupply}
              onChange={(e) =>
                setInitialSupply(e.target.value.replace(/[^0-9]/g, ""))
              }
            />
            <label className="input-label">Initial Supply</label>
          </div>

          <div className="btn-container">
            <button onClick={createToken} className="btn">
              Create a token
            </button>
          </div>
        </div>

        <div
          className={`success-notification ${notification.show ? "show" : ""}`}
        >
          {notification.message}
        </div>

      </div>
      {mintAddress && (
        <footer
          style={{
            position: "fixed",
            left: 0,
            bottom: 0,
            width: "100vw",
            background: "#f1f8fffc",
            borderTop: "1.5px solid #e0e8f0",
            textAlign: "center",
            padding: "22px 6vw 16px 6vw",
            zIndex: 300,
            fontFamily: "'LXGW Bright Code','Poppins',Arial,sans-serif",
            boxShadow: "0 -3px 18px #e6f6ff44"
          }}
        >
          <div style={{fontSize: "16px", color: "#3380ff", fontWeight: "bold", marginBottom: 5}}>
            Token deployed!
          </div>
          <div style={{fontSize: "14px", color: "#222", marginBottom: 3}}>
            <span style={{marginRight: 12}}>Token Address：</span>
            <span style={{fontFamily: "monospace", wordBreak: "break-all", background: "#e0edfff3", borderRadius: 4, padding: "2px 6px"}}>{mintAddress}</span>
          </div>
          <a
            href={`https://solscan.io/token/${mintAddress}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="token-explorer-link"
            style={{
              color: "#2983f7",
              fontWeight: "bold",
              textDecoration: "underline",
              fontSize: "16px",
              marginTop: 7,
              display: "inline-block"
            }}
          >
            Look at the tokens on the blockchain browser
          </a>
        </footer>
      )}
    </>
  );
}
