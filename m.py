
import random
import base64
import json
import os
from math import gcd

from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


# 1 ceasar

def caesar_bruteforce(ciphertext):
    alphabet = "abcdefghijklmnopqrstuvwxyz"

    print("\n=== Завдання 1: Шифр Цезаря ===")

    for key in range(len(alphabet)):
        plaintext = ""

        for char in ciphertext:
            if char in alphabet:
                index = alphabet.index(char)
                plaintext += alphabet[(index - key) % len(alphabet)]
            else:
                plaintext += char

        print(f"Ключ {key:2}: {plaintext}")


#2  visioner

UKRAINIAN_ALPHABET = "абвгґдеєжзиіїйклмнопрстуфхцчшщьюя"


def vigenere_encrypt(text, key):
    text = text.lower()
    key = key.lower()

    if not key or any(c not in UKRAINIAN_ALPHABET for c in key):
        raise ValueError("Ключ має містити лише українські літери.")

    result = ""
    key_index = 0
    n = len(UKRAINIAN_ALPHABET)

    for char in text:
        if char in UKRAINIAN_ALPHABET:
            p = UKRAINIAN_ALPHABET.index(char)
            k = UKRAINIAN_ALPHABET.index(key[key_index % len(key)])
            result += UKRAINIAN_ALPHABET[(p + k) % n]
            key_index += 1
        else:
            result += char

    return result


def vigenere_decrypt(ciphertext, key):
    ciphertext = ciphertext.lower()
    key = key.lower()

    if not key or any(c not in UKRAINIAN_ALPHABET for c in key):
        raise ValueError("Ключ має містити лише українські літери.")

    result = ""
    key_index = 0
    n = len(UKRAINIAN_ALPHABET)

    for char in ciphertext:
        if char in UKRAINIAN_ALPHABET:
            c = UKRAINIAN_ALPHABET.index(char)
            k = UKRAINIAN_ALPHABET.index(key[key_index % len(key)])
            result += UKRAINIAN_ALPHABET[(c - k) % n]
            key_index += 1
        else:
            result += char

    return result


# 3

def is_prime(n):
    if n < 2:
        return False

    for i in range(2, int(n ** 0.5) + 1):
        if n % i == 0:
            return False

    return True


def generate_prime():
    while True:
        number = random.randint(11, 100)
        if is_prime(number):
            return number


def rsa_number_generate_keys():
    p = generate_prime()
    q = generate_prime()

    while q == p:
        q = generate_prime()

    n = p * q
    phi = (p - 1) * (q - 1)

    e = random.randrange(3, phi, 2)
    while gcd(e, phi) != 1:
        e = random.randrange(3, phi, 2)

    d = pow(e, -1, phi)

    return p, q, n, phi, (e, n), (d, n)


def rsa_number_encrypt(message, public_key):
    e, n = public_key

    if not 0 <= message < n:
        raise ValueError("Повідомлення має бути в діапазоні 0 <= M < n.")

    return pow(message, e, n)


def rsa_number_decrypt(ciphertext, private_key):
    d, n = private_key
    return pow(ciphertext, d, n)



#e4 RSA + AES-GCM 


class RSAStringCipher:
    def __init__(self):
        self.private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048
        )
        self.public_key = self.private_key.public_key()

    def encrypt(self, text):
        plaintext = text.encode("utf-8")

        aes_key = AESGCM.generate_key(bit_length=256)
        nonce = os.urandom(12)

        aes = AESGCM(aes_key)
        encrypted_text = aes.encrypt(nonce, plaintext, None)

        encrypted_key = self.public_key.encrypt(
            aes_key,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )

        package = {
            "key": base64.b64encode(encrypted_key).decode("ascii"),
            "nonce": base64.b64encode(nonce).decode("ascii"),
            "data": base64.b64encode(encrypted_text).decode("ascii")
        }

        # Увесь пакет кодуємо в Base64 для передачі та зберігання
        package_bytes = json.dumps(
            package, ensure_ascii=False
        ).encode("utf-8")

        return base64.b64encode(package_bytes).decode("ascii")

    def decrypt(self, ciphertext):
        # Декодуємо Base64-пакет
        package_bytes = base64.b64decode(
            ciphertext, validate=True
        )
        package = json.loads(package_bytes.decode("utf-8"))

        encrypted_key = base64.b64decode(
            package["key"], validate=True
        )
        nonce = base64.b64decode(
            package["nonce"], validate=True
        )
        encrypted_text = base64.b64decode(
            package["data"], validate=True
        )

        aes_key = self.private_key.decrypt(
            encrypted_key,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )

        aes = AESGCM(aes_key)
        plaintext = aes.decrypt(nonce, encrypted_text, None)

        return plaintext.decode("utf-8")



def main():
    caesar_ciphertext = "vppanlwxlyopyncjae"
    caesar_bruteforce(caesar_ciphertext)

    print("\n=== Завдання 2: Шифр Віженера ===")

    original_text = "криптографічніметодизахистуінформації"
    surname = "коваль" 

    encrypted_vigenere = vigenere_encrypt(original_text, surname)
    decrypted_vigenere = vigenere_decrypt(
        encrypted_vigenere, surname
    )

    print("Відкритий текст:", original_text)
    print("Ключ:", surname)
    print("Шифротекст:", encrypted_vigenere)
    print("Розшифрований текст:", decrypted_vigenere)
    print("Перевірка:", original_text == decrypted_vigenere)

    print("\n=== Завдання 3: RSA для числа ===")

    p, q, n, phi, public_key, private_key = (
        rsa_number_generate_keys()
    )

    message = 100
    encrypted_number = rsa_number_encrypt(message, public_key)
    decrypted_number = rsa_number_decrypt(
        encrypted_number, private_key
    )

    print("p =", p)
    print("q =", q)
    print("n =", n)
    print("phi(n) =", phi)
    print("Відкритий ключ (e, n):", public_key)
    print("Закритий ключ (d, n):", private_key)
    print("Початкове число:", message)
    print("Зашифроване число:", encrypted_number)
    print("Розшифроване число:", decrypted_number)
    print("Перевірка:", message == decrypted_number)

    print("\n=== Завдання 4: RSA для рядка + Base64 ===")

    original_string = (
        "Cryptography is fun and educational! "
        "Learning RSA encryption and decryption with Python "
        "helps understand public key cryptosystems."
    )

    rsa_cipher = RSAStringCipher()

    encrypted_string = rsa_cipher.encrypt(original_string)
    decrypted_string = rsa_cipher.decrypt(encrypted_string)

    print("Відкритий текст:", original_string)
    print("\nШифротекст у Base64:")
    print(encrypted_string)
    print("\nРозшифрований текст:", decrypted_string)
    print("Перевірка:", original_string == decrypted_string)


if __name__ == "__main__":
    main()
