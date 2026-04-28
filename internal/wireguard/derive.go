package wireguard

import (
	"errors"
	"strings"

	"golang.zx2c4.com/wireguard/wgctrl/wgtypes"
)

func DerivePublicKey(privateKey string) (string, error) {
	privateKey = strings.TrimSpace(privateKey)
	if privateKey == "" {
		return "", errors.New("private key required")
	}
	k, err := wgtypes.ParseKey(privateKey)
	if err != nil {
		return "", err
	}
	return k.PublicKey().String(), nil
}

