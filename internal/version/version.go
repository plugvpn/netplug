// Package version exposes git revision metadata for the running binary.
//
// Commit may be set at link time for artifacts built without VCS metadata
// (for example Docker images where .git is not present):
//
//	go build -ldflags "-X netplug-go/internal/version.Commit=$(git rev-parse HEAD)"
package version

import (
	"context"
	"os/exec"
	"runtime/debug"
	"strings"
	"sync"
	"time"
)

// Commit is set at link time for release artifacts (Docker, CI). When empty,
// Revision uses embedded toolchain metadata, then git, then the module
// pseudo-version before falling back to "unknown".
var Commit string

var (
	revisionMemo   string
	revisionMemoMu sync.Mutex
	memoFilled     bool
)

// Revision returns the full git commit SHA for this build (or an abbreviated
// form from the module pseudo-version when that is all that exists).
func Revision() string {
	if s := strings.TrimSpace(Commit); s != "" {
		return s
	}

	revisionMemoMu.Lock()
	defer revisionMemoMu.Unlock()
	if memoFilled {
		return revisionMemo
	}
	revisionMemo = computeRevisionWithoutCommit()
	memoFilled = true
	return revisionMemo
}

func computeRevisionWithoutCommit() string {
	info, ok := debug.ReadBuildInfo()
	if ok {
		for _, s := range info.Settings {
			if s.Key == "vcs.revision" {
				if v := strings.TrimSpace(s.Value); v != "" {
					return v
				}
				break
			}
		}
	}

	if rev := revisionFromGit(); rev != "" {
		return rev
	}

	if ok {
		if rev := pseudoVersionAbbrevCommit(info.Main.Version); rev != "" {
			return rev
		}
		if strings.TrimSpace(info.Main.Version) == "(devel)" {
			return "devel"
		}
	}

	return "unknown"
}

func revisionFromGit() string {
	ctx, cancel := context.WithTimeout(context.Background(), 800*time.Millisecond)
	defer cancel()
	cmd := exec.CommandContext(ctx, "git", "rev-parse", "HEAD")
	out, err := cmd.Output()
	if err != nil {
		return ""
	}
	s := strings.TrimSpace(string(out))
	if !isLikelyGitCommitHash(s) {
		return ""
	}
	return s
}

func isLikelyGitCommitHash(s string) bool {
	n := len(s)
	if n != 40 && n != 12 {
		return false
	}
	for i := 0; i < n; i++ {
		c := s[i]
		switch {
		case c >= '0' && c <= '9', c >= 'a' && c <= 'f', c >= 'A' && c <= 'F':
			continue
		default:
			return false
		}
	}
	return true
}

// Display returns the version string that should be shown in tight UI surfaces.
//
// If the revision looks like a release tag (e.g. v1.2.3), we show it verbatim.
// Otherwise we fall back to an abbreviated revision.
func Display() string {
	r := Revision()
	if r == "unknown" {
		return r
	}
	if looksLikeTag(r) {
		return r
	}
	return RevisionShort()
}

func looksLikeTag(s string) bool {
	// We intentionally keep this permissive: if the build injects a tag-like
	// string (starting with 'v'), the UI should show it exactly as provided.
	if len(s) < 2 || s[0] != 'v' {
		return false
	}
	return strings.IndexByte(s, '.') >= 0
}

// pseudoVersionAbbrevCommit extracts the 12-character commit suffix from a
// module pseudo-version (e.g. v0.0.0-20260428184011-111034f0471f+dirty).
func pseudoVersionAbbrevCommit(modVersion string) string {
	v := strings.TrimSpace(modVersion)
	if v == "" || v == "(devel)" {
		return ""
	}
	i := strings.LastIndex(v, "-")
	if i < 0 {
		return ""
	}
	cand := v[i+1:]
	if p := strings.IndexByte(cand, '+'); p >= 0 {
		cand = cand[:p]
	}
	// Go pseudo-versions use a 12-digit lowercase hex commit suffix.
	if len(cand) != 12 {
		return ""
	}
	for i := 0; i < 12; i++ {
		c := cand[i]
		if c >= '0' && c <= '9' || c >= 'a' && c <= 'f' {
			continue
		}
		return ""
	}
	return cand
}

// RevisionShort returns an abbreviated SHA suitable for tight UI (e.g. sidebar).
func RevisionShort() string {
	r := Revision()
	if r == "unknown" {
		return r
	}
	if len(r) > 7 {
		return r[:7]
	}
	return r
}
