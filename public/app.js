let socket;
let privateKey, publicKey, sharedSecret, aesKey;

async function generateKeys() {
    privateKey = await window.crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "X25519" },
        true,
        ["deriveKey", "deriveBits"]
    );
    publicKey = await window.crypto.subtle.exportKey("raw", privateKey.publicKey);
}

async function deriveSharedSecret(partnerPublicKeyRaw) {
    const partnerPublicKey = await window.crypto.subtle.importKey(
        "raw",
        partnerPublicKeyRaw,
        { name: "ECDH", namedCurve: "X25519" },
        true,
        []
    );

    sharedSecret = await window.crypto.subtle.deriveBits(
        { name: "ECDH", public: partnerPublicKey },
        privateKey.privateKey,
        256
    );

    aesKey = await window.crypto.subtle.importKey(
        "raw",
        await crypto.subtle.digest("SHA-256", sharedSecret),
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
    );
}

async function encryptMessage(message) {
    const encoder = new TextEncoder();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        aesKey,
        encoder.encode(message)
    );

    const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.byteLength);

    return combined;
}

async function decryptMessage(data) {
    const iv = data.slice(0, 12);
    const ciphertext = data.slice(12);

    const plaintext = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        aesKey,
        ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(plaintext);
}

async function connect() {
    await generateKeys();

    socket = new WebSocket(location.origin.replace(/^http/, 'ws'));

    socket.binaryType = 'arraybuffer';

    socket.onopen = () => {
        console.log("WebSocket verbunden, sende PublicKey...");
        socket.send(publicKey);
    };

    socket.onmessage = async (event) => {
        const data = new Uint8Array(event.data);

        if (!aesKey) {
            console.log("Empfange Partner Public Key...");
            await deriveSharedSecret(data);
            appendMessage("[System] Verschlüsselung hergestellt.");
        } else {
            const decrypted = await decryptMessage(data);
            appendMessage("[Partner] " + decrypted);
        }
    };

    socket.onclose = () => {
        appendMessage("[System] Verbindung getrennt.");
    };
}

function appendMessage(message) {
    const messages = document.getElementById("messages");
    const div = document.createElement("div");
    div.textContent = message;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

document.getElementById("sendButton").addEventListener("click", async () => {
    const input = document.getElementById("inputField");
    const text = input.value;
    if (!text) return;

    const encrypted = await encryptMessage(text);
    socket.send(encrypted);

    appendMessage("[Du] " + text);
    input.value = "";
});

// Auto-Connect beim Start
connect();
