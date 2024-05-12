// example from https://mantine.dev/core/copy-button/
import { CopyButton as CopyButtonMantine, Button, Tooltip, rem } from '@mantine/core';
import { IconCopy, IconCheck } from '@tabler/icons-react';

export default function CopyButton({value} : {value: string}) {
  // clickable button, upon click, the content of value prop is copied to users clipboard

  // copy is available only in secured context
  // https://developer.mozilla.org/en-US/docs/Web/API/Navigator/clipboard

  if (!window.isSecureContext) {
      return null;
  }

  return (
    <CopyButtonMantine value={value} timeout={2000}>
      {({ copied, copy }) => (
        <Tooltip label={copied ? 'Copied' : 'Copy'} withArrow position="right">
          <Button
            color={copied ? 'teal' : 'blue'}
            size="compact-sm"
            variant="outline"
            onClick={copy}
            leftSection={copied ? (
                <IconCheck style={{ width: rem(20) }} />
              ) : (
                <IconCopy style={{ width: rem(20) }} />
              )
            }
          >
            {
              copied ? "Copied" : "Copy to clipboard"
            }
          </Button>
        </Tooltip>
      )}
    </CopyButtonMantine>
  );
}