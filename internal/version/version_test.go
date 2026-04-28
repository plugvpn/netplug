package version

import (
	"testing"
)

func TestRevision_prefersTrimmedCommitVar(t *testing.T) {
	old := Commit
	t.Cleanup(func() { Commit = old })
	Commit = "  fullsha  "
	if got := Revision(); got != "fullsha" {
		t.Fatalf("Revision() = %q", got)
	}
}

func TestRevisionShort_truncatesLongHex(t *testing.T) {
	old := Commit
	t.Cleanup(func() { Commit = old })
	Commit = "deadbeef0123456789abcdef0123456789abcdef"
	if got := RevisionShort(); got != "deadbee" {
		t.Fatalf("RevisionShort() = %q", got)
	}
}

func TestPseudoVersionAbbrevCommit(t *testing.T) {
	tests := []struct {
		in, want string
	}{
		{"v0.0.0-20260428184011-111034f0471f+dirty", "111034f0471f"},
		{"v0.0.0-20260428184011-111034f0471f", "111034f0471f"},
		{"(devel)", ""},
		{"", ""},
		{"v1.2.3", ""},
	}
	for _, tt := range tests {
		if got := pseudoVersionAbbrevCommit(tt.in); got != tt.want {
			t.Fatalf("pseudoVersionAbbrevCommit(%q) = %q, want %q", tt.in, got, tt.want)
		}
	}
}
