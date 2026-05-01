//go:build !linux

package pcq

func runCommands(_ [][]string) error {
	return nil
}
