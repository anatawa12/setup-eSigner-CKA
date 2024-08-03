#include <windows.h>

void main(void) {
  HANDLE hStdout = GetStdHandle(STD_OUTPUT_HANDLE);
  DWORD written;
  WriteFile(hStdout, "hello world\n", 12, &written, NULL);
}
