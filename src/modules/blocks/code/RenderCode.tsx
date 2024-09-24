import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, ButtonGroup, Sheet, Typography } from '@mui/joy';
import BarChartIcon from '@mui/icons-material/BarChart';
import ChangeHistoryTwoToneIcon from '@mui/icons-material/ChangeHistoryTwoTone';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import HtmlIcon from '@mui/icons-material/Html';
import NumbersRoundedIcon from '@mui/icons-material/NumbersRounded';
import SquareTwoToneIcon from '@mui/icons-material/SquareTwoTone';
import WrapTextIcon from '@mui/icons-material/WrapText';

import { copyToClipboard } from '~/common/util/clipboardUtils';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import { BUTTON_RADIUS, OverlayButton, overlayButtonsActiveSx, overlayButtonsClassName, overlayButtonsTopRightSx, overlayGroupWithShadowSx } from '../OverlayButton';
import { RenderCodeChartJS } from './code-renderers/RenderCodeChartJS';
import { RenderCodeHtmlIFrame } from './code-renderers/RenderCodeHtmlIFrame';
import { RenderCodeMermaid } from './code-renderers/RenderCodeMermaid';
import { RenderCodeSVG } from './code-renderers/RenderCodeSVG';
import { RenderCodeSyntax } from './code-renderers/RenderCodeSyntax';
import { heuristicIsBlockPureHTML } from '../danger-html/RenderDangerousHtml';
import { heuristicIsCodePlantUML, RenderCodePlantUML, usePlantUmlSvg } from './code-renderers/RenderCodePlantUML';
import { useOpenInExternalButtons } from '~/modules/blocks/code/code-buttons/useOpenInExternalButtons';

// style for line-numbers
import './RenderCode.css';


// configuration
const ALWAYS_SHOW_OVERLAY = true;


// RenderCode

export const renderCodeMemoOrNot = (memo: boolean) => memo ? RenderCodeMemo : RenderCode;

export const RenderCodeMemo = React.memo(RenderCode);

interface RenderCodeBaseProps {
  semiStableId: string | undefined,
  title: string,
  code: string,
  isPartial: boolean,
  fitScreen?: boolean,
  initialShowHTML?: boolean,
  noCopyButton?: boolean,
  optimizeLightweight?: boolean,
  sx?: SxProps,
}

function RenderCode(props: RenderCodeBaseProps) {
  return (
    <React.Suspense fallback={<Box component='code' sx={{ p: 1.5, display: 'block', ...props.sx }} />}>
      <_DynamicPrism {...props} />
    </React.Suspense>
  );
}


// Lazy loader of the heavy prism functions
const _DynamicPrism = React.lazy(async () => {

  // Dynamically import the code highlight functions
  const { highlightCode, inferCodeLanguage } = await import('~/modules/blocks/code/code-highlight/codePrism');

  return {
    default: (props: RenderCodeBaseProps) => <RenderCodeImpl highlightCode={highlightCode} inferCodeLanguage={inferCodeLanguage} {...props} />,
  };
});


// Actual implemetation of the code rendering

const renderCodecontainerSx: SxProps = {
  // position the overlay buttons - this has to be one level up from the code, otherwise the buttons will h-scroll with the code
  position: 'relative',

  // style
  '--IconButton-radius': BUTTON_RADIUS,

  // fade in children buttons
  [`&:hover > .${overlayButtonsClassName}`]: overlayButtonsActiveSx,
};

const overlayGridSx: SxProps = {
  ...overlayButtonsTopRightSx,
  display: 'grid',
  gap: 0.5,
  justifyItems: 'end',
};


const overlayFirstRowSx: SxProps = {
  display: 'flex',
  gap: 0.5,
};

function RenderCodeImpl(props: RenderCodeBaseProps & {
  highlightCode: (inferredCodeLanguage: string | null, code: string, addLineNumbers: boolean) => string,
  inferCodeLanguage: (blockTitle: string, code: string) => string | null,
}) {

  // state
  // const [isHovering, setIsHovering] = React.useState(false);
  const [fitScreen, setFitScreen] = React.useState(!!props.fitScreen);
  const [showHTML, setShowHTML] = React.useState(props.initialShowHTML === true);
  const [showMermaid, setShowMermaid] = React.useState(true);
  const [showPlantUML, setShowPlantUML] = React.useState(true);
  const [showSVG, setShowSVG] = React.useState(true);
  const [showChartJS, setShowChartJS] = React.useState(true);
  const { showLineNumbers, showSoftWrap, setShowLineNumbers, setShowSoftWrap } = useUIPreferencesStore(useShallow(state => ({
    showLineNumbers: state.renderCodeLineNumbers,
    showSoftWrap: state.renderCodeSoftWrap,
    setShowLineNumbers: state.setRenderCodeLineNumbers,
    setShowSoftWrap: state.setRenderCodeSoftWrap,
  })));

  // derived props
  const {
    title: blockTitle,
    code,
    isPartial: blockIsPartial,
    highlightCode,
    inferCodeLanguage,
  } = props;

  const noTooltips = props.optimizeLightweight /*|| !isHovering*/;


  // handlers

  // const handleMouseOverEnter = React.useCallback(() => setIsHovering(true), []);

  // const handleMouseOverLeave = React.useCallback(() => setIsHovering(false), []);

  const handleCopyToClipboard = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    copyToClipboard(code, 'Code');
  }, [code]);


  // heuristics for specialized rendering

  const lcBlockTitle = blockTitle.trim().toLowerCase();

  const isHTMLCode = heuristicIsBlockPureHTML(code);
  const renderHTML = isHTMLCode && showHTML;

  const isMermaidCode = lcBlockTitle === 'mermaid' && !blockIsPartial;
  const renderMermaid = isMermaidCode && showMermaid;

  const isPlantUMLCode = heuristicIsCodePlantUML(code);
  let renderPlantUML = isPlantUMLCode && showPlantUML;
  const { data: plantUmlSvgData, error: plantUmlError } = usePlantUmlSvg(renderPlantUML, code);
  renderPlantUML = renderPlantUML && (!!plantUmlSvgData || !!plantUmlError);

  const isSVGCode = (code.startsWith('<svg') || code.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<svg')) && code.endsWith('</svg>');
  const renderSVG = isSVGCode && showSVG;
  const canScaleSVG = renderSVG && code.includes('viewBox="');

  const isChartJSCode = lcBlockTitle === 'chartjs' && !blockIsPartial;
  const renderChartJS = isChartJSCode && showChartJS;

  const renderSyntaxHighlight = !renderHTML && !renderMermaid && !renderPlantUML && !renderSVG && !renderChartJS;
  const cannotRenderLineNumbers = !renderSyntaxHighlight || showSoftWrap || renderChartJS;
  const renderLineNumbers = showLineNumbers && !cannotRenderLineNumbers;


  // Language & Highlight
  const { highlightedCode, inferredCodeLanguage } = React.useMemo(() => {
    const inferredCodeLanguage = inferCodeLanguage(blockTitle, code);
    const highlightedCode =
      !renderSyntaxHighlight ? null
        : code ? highlightCode(inferredCodeLanguage, code, renderLineNumbers)
          : null;
    return { highlightedCode, inferredCodeLanguage };
  }, [code, blockTitle, highlightCode, inferCodeLanguage, renderLineNumbers, renderSyntaxHighlight]);


  // Title
  let showBlockTitle = (blockTitle != inferredCodeLanguage) && (blockTitle.includes('.') || blockTitle.includes('://'));
  // Beautify: hide the block title when rendering HTML
  if (renderHTML)
    showBlockTitle = false;
  const isBorderless = (renderHTML || renderSVG) && !showBlockTitle;


  // External Buttons
  const openExternallyButtons = useOpenInExternalButtons(code, blockTitle, blockIsPartial, inferredCodeLanguage, isSVGCode, noTooltips === true);

  // style

  const isRenderingDiagram = renderMermaid || renderPlantUML;
  const hasExternalButtons = openExternallyButtons.length > 0;

  const codeSx: SxProps = React.useMemo(() => ({

    // style
    p: isBorderless ? 0 : 1.5, // this block gets a thicker border (but we 'fullscreen' html in case there's no title)
    overflowX: 'auto', // ensure per-block x-scrolling
    whiteSpace: showSoftWrap ? 'break-spaces' : 'pre',

    // layout
    display: 'flex',
    flexDirection: 'column',
    // justifyContent: (renderMermaid || renderPlantUML) ? 'center' : undefined,

    // fix for SVG diagrams over dark mode: https://github.com/enricoros/big-AGI/issues/520
    '[data-joy-color-scheme="dark"] &': isRenderingDiagram ? { backgroundColor: 'neutral.500' } : {},

    // lots more style, incl font, background, embossing, radius, etc.
    ...props.sx,

    // patch the min height if we have the second row
    ...(hasExternalButtons ? { minHeight: '5.25rem' } : {}),

  }), [hasExternalButtons, isBorderless, isRenderingDiagram, props.sx, showSoftWrap]);


  return (
    <Box
      // onMouseEnter={handleMouseOverEnter}
      // onMouseLeave={handleMouseOverLeave}
      sx={renderCodecontainerSx}
    >

      <Box
        component='code'
        className={`language-${inferredCodeLanguage || 'unknown'}${renderLineNumbers ? ' line-numbers' : ''}`}
        sx={codeSx}
      >

        {/* Markdown Title (File/Type) */}
        {showBlockTitle && (
          <Sheet sx={{ backgroundColor: 'background.popup', boxShadow: 'xs', borderRadius: 'sm', border: '1px solid var(--joy-palette-neutral-outlinedBorder)', m: -0.5, mb: 1.5 }}>
            <Typography level='body-sm' sx={{ px: 1, py: 0.5, color: 'text.primary' }}>
              {blockTitle}
              {/*{inferredCodeLanguage}*/}
            </Typography>
          </Sheet>
        )}

        {/* Renders HTML, or inline SVG, inline plantUML rendered, or highlighted code */}
        {renderHTML ? <RenderCodeHtmlIFrame htmlCode={code} />
          : renderMermaid ? <RenderCodeMermaid mermaidCode={code} fitScreen={fitScreen} />
            : renderSVG ? <RenderCodeSVG svgCode={code} fitScreen={fitScreen} />
              : (renderPlantUML && (plantUmlSvgData || plantUmlError)) ? <RenderCodePlantUML svgCode={plantUmlSvgData ?? null} error={plantUmlError} fitScreen={fitScreen} />
                : renderChartJS ? <RenderCodeChartJS chartJSCode={code} fitScreen={fitScreen} />
                  : <RenderCodeSyntax highlightedSyntaxAsHtml={highlightedCode} />}


      </Box>

      {/* [overlay] Buttons (Code blocks (SVG, diagrams, HTML, syntax, ...)) */}
      {(ALWAYS_SHOW_OVERLAY /*|| isHovering*/) && (
        <Box className={overlayButtonsClassName} sx={overlayGridSx}>

          {/* [row 1] */}
          <Box sx={overlayFirstRowSx}>

            {/* Show HTML */}
            {isHTMLCode && (
              <OverlayButton tooltip={noTooltips ? null : renderHTML ? 'Show Code' : 'Show Web Page'} variant={renderHTML ? 'solid' : 'outlined'} color='danger' smShadow onClick={() => setShowHTML(!showHTML)}>
                <HtmlIcon sx={{ fontSize: 'xl2' }} />
              </OverlayButton>
            )}

            {/* Show SVG */}
            {isSVGCode && (
              <OverlayButton tooltip={noTooltips ? null : renderSVG ? 'Show Code' : 'Render SVG'} variant={renderSVG ? 'solid' : 'outlined'} color='warning' smShadow onClick={() => setShowSVG(!showSVG)}>
                <ChangeHistoryTwoToneIcon />
              </OverlayButton>
            )}

            {/* Show Diagrams */}
            {(isMermaidCode || isPlantUMLCode) && (
              <ButtonGroup aria-label='Diagram' sx={overlayGroupWithShadowSx}>
                {/* Toggle rendering */}
                <OverlayButton tooltip={noTooltips ? null : (renderMermaid || renderPlantUML) ? 'Show Code' : isMermaidCode ? 'Mermaid Diagram' : 'PlantUML Diagram'} variant={(renderMermaid || renderPlantUML) ? 'solid' : 'outlined'} onClick={() => {
                  if (isMermaidCode) setShowMermaid(on => !on);
                  if (isPlantUMLCode) setShowPlantUML(on => !on);
                }}>
                  <SquareTwoToneIcon />
                </OverlayButton>

                {/* Fit-To-Screen */}
                {((isMermaidCode && showMermaid) || (isPlantUMLCode && showPlantUML && !plantUmlError) || (isSVGCode && showSVG && canScaleSVG)) && (
                  <OverlayButton tooltip={noTooltips ? null : fitScreen ? 'Original Size' : 'Fit Screen'} variant={fitScreen ? 'solid' : 'outlined'} onClick={() => setFitScreen(on => !on)}>
                    <FitScreenIcon />
                  </OverlayButton>
                )}
              </ButtonGroup>
            )}

            {/* Show ChartJS */}
            {isChartJSCode && (
              <OverlayButton
                tooltip={noTooltips ? null : renderChartJS ? 'Show Code' : 'Render Chart'}
                variant={renderChartJS ? 'solid' : 'outlined'}
                color='primary'
                smShadow
                onClick={() => setShowChartJS(on => !on)}
              >
                <BarChartIcon />
              </OverlayButton>
            )}

            {/* Group: Text Options */}
            <ButtonGroup aria-label='Text and code options' sx={overlayGroupWithShadowSx}>
              {/* Soft Wrap toggle */}
              {renderSyntaxHighlight && (
                <OverlayButton tooltip={noTooltips ? null : 'Soft Wrap'} disabled={!renderSyntaxHighlight} variant={(showSoftWrap && renderSyntaxHighlight) ? 'solid' : 'outlined'} onClick={() => setShowSoftWrap(!showSoftWrap)}>
                  <WrapTextIcon />
                </OverlayButton>
              )}

              {/* Line Numbers toggle */}
              {renderSyntaxHighlight && (
                <OverlayButton tooltip={noTooltips ? null : 'Line Numbers'} disabled={cannotRenderLineNumbers} variant={(renderLineNumbers && renderSyntaxHighlight) ? 'solid' : 'outlined'} onClick={() => setShowLineNumbers(!showLineNumbers)}>
                  <NumbersRoundedIcon />
                </OverlayButton>
              )}

              {/* Copy */}
              {props.noCopyButton !== true && (
                <OverlayButton tooltip={noTooltips ? null : 'Copy Code'} variant='outlined' onClick={handleCopyToClipboard}>
                  <ContentCopyIcon />
                </OverlayButton>
              )}
            </ButtonGroup>
          </Box>

          {/* [row 2, optional] Group: Open Externally */}
          {!!openExternallyButtons.length && (
            <ButtonGroup aria-label='Open code in external editors' sx={overlayGroupWithShadowSx}>
              {openExternallyButtons}
            </ButtonGroup>
          )}

        </Box>
      )}

    </Box>
  );
}
