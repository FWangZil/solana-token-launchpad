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
  const [tokenImageFile, setTokenImageFile] = useState(null);
  const [initialSupply, setInitialSupply] = useState("");
  const [notification, setNotification] = useState({
    show: false,
    message: "",
  });
  const [mintAddress, setMintAddress] = useState("");

  // Metadata URL/Manual mode
  const [metadataUrlMode, setMetadataUrlMode] = useState(true); // true: URL, false: manual
  const [metadataUrl, setMetadataUrl] = useState("");
  const [metadataFields, setMetadataFields] = useState({
    description: "",
    website: "",
    image: "",
    external_url: "",
    attributes: [],
    extensions: [],
  });

  // For dynamic attributes/extensions
  const handleMetadataFieldChange = (field, value) => {
    setMetadataFields((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAttributeChange = (idx, key, value) => {
    setMetadataFields((prev) => {
      const attrs = [...prev.attributes];
      attrs[idx] = { ...attrs[idx], [key]: value };
      return { ...prev, attributes: attrs };
    });
  };

  const addAttribute = () => {
    setMetadataFields((prev) => ({
      ...prev,
      attributes: [...prev.attributes, { trait_type: "", value: "" }],
    }));
  };

  const removeAttribute = (idx) => {
    setMetadataFields((prev) => {
      const attrs = [...prev.attributes];
      attrs.splice(idx, 1);
      return { ...prev, attributes: attrs };
    });
  };

  const handleExtensionChange = (idx, key, value) => {
    setMetadataFields((prev) => {
      const exts = [...prev.extensions];
      exts[idx] = { ...exts[idx], [key]: value };
      return { ...prev, extensions: exts };
    });
  };

  const addExtension = () => {
    setMetadataFields((prev) => ({
      ...prev,
      extensions: [...prev.extensions, { key: "", value: "" }],
    }));
  };

  const removeExtension = (idx) => {
    setMetadataFields((prev) => {
      const exts = [...prev.extensions];
      exts.splice(idx, 1);
      return { ...prev, extensions: exts };
    });
  };

  // Uploading to IPFS using QuickNode
  async function uploadToIPFS(data) {
    const QUICKNODE_API_KEY = import.meta.env.VITE_QUICKNODE_API_KEY;
    const IPFS_GATEWAY =
      import.meta.env.VITE_IPFS_GATEWAY || "gateway.pinata.cloud"; // Or your preferred public gateway

    if (!QUICKNODE_API_KEY) {
      console.error(
        "QuickNode API Key is not configured. Please set VITE_QUICKNODE_API_KEY in .env"
      );
      return Promise.reject(new Error("QuickNode API Key not configured."));
    }

    const formData = new FormData();
    let fileName;
    let contentType;

    if (data instanceof File) {
      console.log("Preparing file for QuickNode IPFS upload:", data.name);
      formData.append("Body", data);
      fileName = `file-${Math.random().toString(36).substring(2, 10)}-${data.name}`;
      contentType = data.type || "application/octet-stream";
    } else if (typeof data === "object" && data !== null) {
      console.log("Preparing JSON metadata for QuickNode IPFS upload");
      const jsonString = JSON.stringify(data);
      fileName = `metadata-${Math.random().toString(36).substring(2, 10)}.json`;
      const metadataFile = new File([jsonString], fileName, {
        type: "application/json",
      });
      formData.append("Body", metadataFile);
      contentType = "application/json";
    } else {
      return Promise.reject(new Error("Invalid data type for IPFS upload"));
    }

    formData.append("Key", fileName);
    formData.append("ContentType", contentType);

    try {
      console.log(`Uploading ${fileName} to QuickNode IPFS...`);
      const response = await fetch(
        "https://api.quicknode.com/ipfs/rest/v1/s3/put-object",
        {
          method: "POST",
          headers: {
            "x-api-key": QUICKNODE_API_KEY,
            // FormData sets Content-Type automatically with boundary
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: response.statusText }));
        console.error("QuickNode IPFS API Error:", errorData);
        throw new Error(
          `Failed to upload to IPFS via QuickNode: ${
            errorData.message || response.statusText
          }`
        );
      }

      const result = await response.json();
      console.log("QuickNode IPFS Upload Result:", result);

      if (result && result.pin && result.pin.cid) {
        const cid = result.pin.cid;
        const ipfsUrl = `https://${IPFS_GATEWAY}/ipfs/${cid}`;
        console.log("Successfully uploaded to IPFS via QuickNode. CID:", cid);
        console.log("IPFS URL:", ipfsUrl);
        return ipfsUrl;
      } else {
        console.error("QuickNode upload result does not contain CID:", result);
        throw new Error("QuickNode upload did not return a CID.");
      }
    } catch (error) {
      console.error("Error uploading to QuickNode IPFS:", error);
      return Promise.reject(
        new Error(
          "Failed to upload to IPFS: " + (error.message || "Unknown error")
        )
      );
    }
  }

  async function createToken() {
    let name, symbol, uri;
    let metadataExtensions = []; // Initialize with a default value
    if (metadataUrlMode) {
      // URL mode
      if (!tokenName || !tokenSymbol || !metadataUrl || !initialSupply) {
        setNotification({ show: true, message: "Please fill in all fields" });
        setTimeout(() => setNotification({ show: false, message: "" }), 3000);
        return;
      }
      name = tokenName;
      symbol = tokenSymbol;
      uri = metadataUrl;
    } else {
      // Manual mode
      if (
        !tokenName ||
        !tokenSymbol ||
        (!metadataFields.image && !tokenImageFile) || // Check if either image URL or image file is provided
        !metadataFields.description ||
        !metadataFields.website ||
        !initialSupply
      ) {
        setNotification({
          show: true,
          message: "Please fill in all required fields",
        });
        setTimeout(() => setNotification({ show: false, message: "" }), 3000);
        return;
      }
      let finalImageUri = metadataFields.image;
      if (tokenImageFile) {
        console.log("Uploading image to IPFS...");
        try {
          finalImageUri = await uploadToIPFS(tokenImageFile);
        } catch (e) {
          setNotification({
            show: true,
            message: "Failed to upload image to IPFS: " + e.message,
          });
          setTimeout(() => setNotification({ show: false, message: "" }), 3000);
          return;
        }
      }

      metadataExtensions = metadataFields.extensions.reduce(
        (acc, cur) => {
          if (cur.key && cur.value) acc[cur.key] = cur.value;
          return acc;
        },
        []
      );

      console.log("metadataExtensions:", metadataExtensions);

      const metadataJson = {
        name: tokenName,
        symbol: tokenSymbol,
        description: metadataFields.description,
        website: metadataFields.website,
        image: finalImageUri, // Use the potentially IPFS-uploaded image URI
        external_url: metadataFields.external_url,
        attributes: metadataFields.attributes,
        extensions: metadataExtensions,
      };
      // upload to IPFS
      try {
        uri = await uploadToIPFS(metadataJson);
      } catch (e) {
        setNotification({
          show: true,
          message: "Failed to upload metadata to IPFS: " + e.message,
        });
        setTimeout(() => setNotification({ show: false, message: "" }), 3000);
        return;
      }
      name = tokenName;
      symbol = tokenSymbol;
    }

    const mintKeypair = Keypair.generate();
    const metadata = {
      mint: mintKeypair.publicKey,
      name: name,
      symbol: symbol.padEnd(10).slice(0, 10),
      uri: uri,
      additionalMetadata: metadataExtensions || [],
    };

    console.log("metadata:", metadata);

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
        message: `Successfully created token ${name} (${symbol})!`,
      });
      setMintAddress(mintKeypair.publicKey.toBase58()); // Store Mint address after successful transaction
      setTimeout(() => setNotification({ show: false, message: "" }), 5000);

      // Reset form
      setTokenName("");
      setTokenSymbol("");
      setTokenImageFile(null); // Clear the selected file
      setInitialSupply("");
      setMetadataUrl("");
      setMetadataFields({
        description: "",
        website: "",
        image: "",
        external_url: "",
        attributes: [],
        extensions: [],
      });
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

          {/* Metadata URL/Manual Switch */}
          <div
            style={{ display: "flex", alignItems: "center", marginBottom: 16 }}
          >
            <label style={{ marginRight: 10, fontWeight: 500 }}>
              Use Metadata URL
            </label>
            <input
              type="checkbox"
              checked={metadataUrlMode}
              onChange={() => setMetadataUrlMode((v) => !v)}
              style={{ width: 20, height: 20 }}
            />
            <span style={{ marginLeft: 10, color: "#888", fontSize: 13 }}>
              {metadataUrlMode ? "URL Mode" : "Manual Mode"}
            </span>
          </div>

          {/* Name & Symbol always shown */}
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
          {metadataUrlMode ? (
            <>
              <div className="input-group">
                <input
                  className="inputText"
                  type="text"
                  placeholder=" "
                  value={metadataUrl}
                  onChange={(e) => setMetadataUrl(e.target.value)}
                />
                <label className="input-label">Metadata URL</label>
              </div>
            </>
          ) : (
            <>
              <div
                style={{
                  border: "1.5px solid #e0e8f0",
                  borderRadius: 8,
                  background: "#f8fbff",
                  padding: "18px 16px 10px 16px",
                  marginBottom: 18,
                  marginTop: 8,
                  boxShadow: "0 2px 12px #e6f6ff33",
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 16,
                    marginBottom: 10,
                    color: "#3380ff",
                    letterSpacing: 0.5,
                  }}
                >
                  Token Metadata Information
                </div>
                <div className="input-group">
                  <input
                    className="inputText"
                    type="text"
                    placeholder=" "
                    value={metadataFields.description}
                    onChange={(e) =>
                      handleMetadataFieldChange("description", e.target.value)
                    }
                  />
                  <label className="input-label">Description</label>
                </div>
                <div className="input-group">
                  <input
                    className="inputText"
                    type="text"
                    placeholder=" "
                    value={metadataFields.website}
                    onChange={(e) =>
                      handleMetadataFieldChange("website", e.target.value)
                    }
                  />
                  <label className="input-label">website</label>
                </div>
                <div className="input-group">
                  <input
                    className="inputText"
                    type="text"
                    placeholder=" "
                    value={metadataFields.image}
                    onChange={(e) =>
                      handleMetadataFieldChange("image", e.target.value)
                    }
                    disabled={!!tokenImageFile} // Disable if a file is selected
                  />
                  <label className="input-label">
                    Image URL (or select file below)
                  </label>
                </div>
                <div className="input-group">
                  <label
                    htmlFor="imageFile"
                    style={{
                      display: "block",
                      marginBottom: "5px",
                      fontWeight: 500,
                    }}
                  >
                    Upload Image File (optional):
                  </label>
                  <input
                    id="imageFile"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      setTokenImageFile(e.target.files[0]);
                      if (e.target.files[0]) {
                        // Optionally clear the image URL field if a file is selected
                        handleMetadataFieldChange("image", "");
                      }
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                    }}
                  />
                  {tokenImageFile && (
                    <span style={{ fontSize: "12px", color: "#555" }}>
                      Selected: {tokenImageFile.name}
                    </span>
                  )}
                </div>
                <div className="input-group">
                  <input
                    className="inputText"
                    type="text"
                    placeholder=" "
                    value={metadataFields.external_url}
                    onChange={(e) =>
                      handleMetadataFieldChange("external_url", e.target.value)
                    }
                  />
                  <label className="input-label">External URL</label>
                </div>
                {/* Attributes */}
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontWeight: 500 }}>Attributes</label>
                  {metadataFields.attributes.map((attr, idx) => (
                    <div
                      key={idx}
                      style={{ display: "flex", gap: 8, marginBottom: 4 }}
                    >
                      <input
                        className="inputText"
                        style={{ flex: 1 }}
                        type="text"
                        placeholder="trait_type"
                        value={attr.trait_type}
                        onChange={(e) =>
                          handleAttributeChange(
                            idx,
                            "trait_type",
                            e.target.value
                          )
                        }
                      />
                      <input
                        className="inputText"
                        style={{ flex: 1 }}
                        type="text"
                        placeholder="value"
                        value={attr.value}
                        onChange={(e) =>
                          handleAttributeChange(idx, "value", e.target.value)
                        }
                      />
                      <button
                        type="button"
                        onClick={() => removeAttribute(idx)}
                        style={{
                          color: "#e33",
                          border: "none",
                          background: "none",
                          fontWeight: "bold",
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addAttribute}
                    style={{ fontSize: 13, marginTop: 2 }}
                  >
                    + Add Attribute
                  </button>
                </div>
                {/* Extensions */}
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontWeight: 500 }}>Extensions</label>
                  {metadataFields.extensions.map((ext, idx) => (
                    <div
                      key={idx}
                      style={{ display: "flex", gap: 8, marginBottom: 4 }}
                    >
                      <input
                        className="inputText"
                        style={{ flex: 1 }}
                        type="text"
                        placeholder="key"
                        value={ext.key}
                        onChange={(e) =>
                          handleExtensionChange(idx, "key", e.target.value)
                        }
                      />
                      <input
                        className="inputText"
                        style={{ flex: 1 }}
                        type="text"
                        placeholder="value"
                        value={ext.value}
                        onChange={(e) =>
                          handleExtensionChange(idx, "value", e.target.value)
                        }
                      />
                      <button
                        type="button"
                        onClick={() => removeExtension(idx)}
                        style={{
                          color: "#e33",
                          border: "none",
                          background: "none",
                          fontWeight: "bold",
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addExtension}
                    style={{ fontSize: 13, marginTop: 2 }}
                  >
                    + Add Extension
                  </button>
                </div>
              </div>
            </>
          )}

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
            boxShadow: "0 -3px 18px #e6f6ff44",
          }}
        >
          <div
            style={{
              fontSize: "16px",
              color: "#3380ff",
              fontWeight: "bold",
              marginBottom: 5,
            }}
          >
            Token deployed!
          </div>
          <div style={{ fontSize: "14px", color: "#222", marginBottom: 3 }}>
            <span style={{ marginRight: 12 }}>Token Address: </span>
            <span
              style={{
                fontFamily: "monospace",
                wordBreak: "break-all",
                background: "#e0edfff3",
                borderRadius: 4,
                padding: "2px 6px",
              }}
            >
              {mintAddress}
            </span>
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
              display: "inline-block",
            }}
          >
            View Token on Blockchain Explorer
          </a>
        </footer>
      )}
    </>
  );
}
