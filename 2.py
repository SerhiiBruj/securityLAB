
alphabet = "абвгґдеєжзиіїйклмнопрстуфхцчшщьюя"

def vigenere_encrypt(text, key):
    text = text.lower().replace(" ", "")
    key = key.lower()
    result = ""

    for i, char in enumerate(text):
        if char in alphabet:
            text_index = alphabet.index(char)
            key_index = alphabet.index(key[i % len(key)])
            result += alphabet[(text_index + key_index) % len(alphabet)]
        else:
            result += char

    return result


def vigenere_decrypt(text, key):
    result = ""

    for i, char in enumerate(text):
        if char in alphabet:
            text_index = alphabet.index(char)
            key_index = alphabet.index(key[i % len(key)])
            result += alphabet[(text_index - key_index) % len(alphabet)]
        else:
            result += char

    return result


text = "криптографічніметодизахистуінформації"
key = "коваль"  

ciphertext = vigenere_encrypt(text, key)
decrypted = vigenere_decrypt(ciphertext, key)

print("Відкритий текст:", text)
print("Ключ:", key)
print("Зашифрований текст:", ciphertext)
print("Розшифрований текст:", decrypted)
print("Перевірка:", text == decrypted)
