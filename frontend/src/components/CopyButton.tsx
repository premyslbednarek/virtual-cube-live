// example from https://mantine.dev/core/copy-button/
import { CopyButton as CopyButtonMantine, Button, Tooltip, rem } from '@mantine/core';
import { IconCopy, IconCheck } from '@tabler/icons-react';

export default function CopyButton({value} : {value: string}) {
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