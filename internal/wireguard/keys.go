package wireguard

import (
	"golang.zx2c4.com/wireguard/wgctrl/wgtypes"
)

func GenerateKeyPair() (privateKey string, publicKey string, err error) {
	k, err := wgtypes.GeneratePrivateKey()
	if err != nil {
		return "", "", err
	}
	return k.String(), k.PublicKey().String(), nil
}

