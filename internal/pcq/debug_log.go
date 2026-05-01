package pcq

import (
	"log/slog"
	"sort"
)

// ApplyOpts enables structured logging when NETPLUG_DEBUG (or equivalent) is on at the caller.
type ApplyOpts struct {
	Debug  bool
	Logger *slog.Logger
}

func (o ApplyOpts) log() (*slog.Logger, bool) {
	if !o.Debug || o.Logger == nil {
		return nil, false
	}
	return o.Logger, true
}

type peerApplyRecord struct {
	TunnelIPv4        string `json:"tunnel_ipv4"`
	DownloadKbps      int    `json:"download_kbps,omitempty"`
	UploadKbps        int    `json:"upload_kbps,omitempty"`
	BurstDownloadKbps int    `json:"burst_download_kbps,omitempty"`
	BurstUploadKbps   int    `json:"burst_upload_kbps,omitempty"`
}

func peersApplyRecords(peers map[string]PeerLimit) []peerApplyRecord {
	if len(peers) == 0 {
		return nil
	}
	keys := make([]string, 0, len(peers))
	for ip := range peers {
		keys = append(keys, ip)
	}
	sort.Strings(keys)
	out := make([]peerApplyRecord, 0, len(keys))
	for _, ip := range keys {
		pl := peers[ip]
		out = append(out, peerApplyRecord{
			TunnelIPv4:        ip,
			DownloadKbps:      pl.DownloadKbps,
			UploadKbps:        pl.UploadKbps,
			BurstDownloadKbps: pl.BurstDownloadKbps,
			BurstUploadKbps:   pl.BurstUploadKbps,
		})
	}
	return out
}

func summarizePeerDirections(peers map[string]PeerLimit) (needsDownload, needsUpload bool) {
	for _, pl := range peers {
		if pl.DownloadKbps > 0 {
			needsDownload = true
		}
		if pl.UploadKbps > 0 {
			needsUpload = true
		}
	}
	return needsDownload, needsUpload
}
