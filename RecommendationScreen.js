// TODO replace native bind with lodash/fp bind
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { isUndefined, isEmpty } from 'lodash';
import Promise from 'bluebird';
import { connect } from 'react-redux';
import moment from 'moment';
import {
  Text,
  View,
  NativeModules,
} from 'react-native';
import SwipeCards from 'react-native-swipe-cards';
import Modal from 'react-native-modalbox';
import TasteResultsModal from '../../AlertModals/TasteResultsModal';
import styles from '../../../styles/RecommendationScreen';
import { navigate } from '../../../redux/actions/nav';
import RenderMovies from './RenderMovies';
import RatingModal from '../../AlertModals/RatingModal';
import QuickRate from '../Taste/QuickRate/QuickRate';
import { showNavigationBar, hideNavigationBar } from '../../../redux/actions/navBar';
import ActionModal from '../../../components/ActionModal';
import recommendationModalConfs from '../Taste/ModalConfs';
import subscriptionModalConfs from './subscriptionModalConfs';
import { clearUserNewSignUp } from '../../../redux/actions/globalFlags';


import {
  getMovies,
  getMoviesToDisplay,
  isRequestInProgress,
  getMoviesNotYetDisplayed,
} from '../../../redux/selectors/recommendations';

import {
  removeMovieFromDisplay,
  fetchRecommendedMovies,
  clearRecommendedMovies,
} from '../../../redux/actions/recommendations';

import { addMovieToWatchList } from '../../../redux/actions/wishList';
import { dismissMovie } from '../../../redux/actions/movies';
import startTrialSubscription from '../../../redux/actions/startTrial';
import verifyInAppPurchase from '../../../redux/actions/verifyInAppPurchase';

const { InAppUtils } = NativeModules;


const cards = [
  { name: '1', image: 'https://media.giphy.com/media/GfXFVHUzjlbOg/giphy.gif' },
];

// spaces are added because we cannot keep the size fixed
// as some text is really short and other are long
const filterCategories = {
  key1: '   All   ',
  key2: ' This Year ',
  key3: ' 80s & 90s ',
  key4: ' Classics ',
  key5: ' Netflix ',
  key6: ' Comedy ',
  key7: ' Fast-Paced ',
  key8: ' Recently Added ',
};

const USER_LEVEL = 1;
const USER_RANK = 1;


function isViewMoreMoviesAllowed(currentUser) {
  if (!isEmpty(currentUser.profile.premium) && currentUser.profile.premium.active) {
    if (currentUser.profile.premium.dateExpires) {
      const expDate = moment.unix(currentUser.profile.premium.dateExpires / 1000);
      if (expDate < moment()) {
        return false;
      }
    }
    return true;
  }
  return false;
}

function getCategory(key) {
  if (key === 'key1') {
    return 'top';
  }
  if (key === 'key2') {
    return 'recent';
  }
  if (key === 'key3') {
    return '80s90s';
  }
  if (key === 'key4') {
    return 'classics';
  }
  if (key === 'key5') {
    return 'netflix';
  }
  if (key === 'key6') {
    return 'comedy';
  }
  if (key === 'key7') {
    return 'fast';
  }
  if (key === 'key8') {
    return 'new';
  }

  return 's';
}

class RecommendationScreen extends Component {
  static onMovie() {}

  static renderTitle() {
    return (
      <View style={styles.titleContainer}>
        <Text style={styles.titleText}>What To Watch</Text>
      </View>
    );
  }

  constructor(props) {
    super(props);

    this.state = {
      cards,
      currentBookmarkedMovies: {},
      currentDismissedMovies: {},
      currentRatedMovies: {},
      currentSeenMovie: null,
      hideRecommendationsNow: false,
      selectedCategory: 'key1',
      showModal: false,
      showResultModal: false,
      showTasteScreen: false,
      showQuickReact: false,
      showSubscriptionModal: false,
      showStickyHeader: false,
      requestInProgress: false,
      iosInAppPurchases: [
        'io.taste.ios.premium12',
      ],
      isInAppPurchaseInProgress: false,
      forceShow4thSubscriptionModal: false,
    };

    this.handleCardDismissal = this.handleCardDismissal.bind(this);
    this.handleChangeCategory = this.handleChangeCategory.bind(this);
    this.onBookmark = this.onBookmark.bind(this);
    this.onClose = this.onClose.bind(this);
    this.onSeeAllRecommendations = this.onSeeAllRecommendations.bind(this);
    this.onSeen = this.onSeen.bind(this);
    this.redirectToRatingScreen = this.redirectToRatingScreen.bind(this);
    this.renderModal = this.renderModal.bind(this);
    this.showProfileModal = this.showProfileModal.bind(this);
    this.viewRecommendations = this.viewRecommendations.bind(this);
    this.handleLoadMore = this.handleLoadMore.bind(this);
    this.handleTasteScreenCancel = this.handleTasteScreenCancel.bind(this);
    this.refreshRecommendations = this.refreshRecommendations.bind(this);
    this.onSubcriptionModalYesPress = this.onSubcriptionModalYesPress.bind(this);
    this.onSubcriptionModalNoPress = this.onSubcriptionModalNoPress.bind(this);
  }


  componentWillMount() {
    this.setState({ requestInProgress: true });
    this.props.fetchRecommendedMovies({ inbox: 'top' });

    const { props: { userNewSignUp } } = this;
    if (userNewSignUp) { this.props.hideNavigationBar(); } else { this.props.showNavigationBar(); }
  }

  componentWillReceiveProps(newProps) {
    if (newProps.movies !== this.props.movies && newProps.movies.length) {
      this.setState({ requestInProgress: false });
    }

    if (newProps.currentUser.profile.premium !== this.props.currentUser.profile.premium) {
      this.setState({
        forceShow4thSubscriptionModal: false,
      });
      this.props.fetchRecommendedMovies({ inbox: getCategory(this.state.selectedCategory) });
    }
  }

  componentWillUnmount() {
    this.props.clearRecommendedMovies();
  }

  onSubcriptionModalYesPress() {
    const { showSubscriptionModal } = this.state;
    if (showSubscriptionModal) {
      if (this.getSubsciptionModalType() === 1) {
        this.props.startTrialSubscription();
      }

      if (this.getSubsciptionModalType() === 2) {
        this.setState({
          showSubscriptionModal: false,
        });
        this.props.showNavigationBar();
      }

      if (this.getSubsciptionModalType() === 3) {
        this.setState({
          forceShow4thSubscriptionModal: true,
        });
      }

      if (this.getSubsciptionModalType() === 4) {
        this.setState({ isInAppPurchaseInProgress: true });
        // eslint-disable-next-line
        InAppUtils.loadProducts(this.state.iosInAppPurchases, (error, products) => {
          if (error) {
            // eslint-disable-next-line
            return this.setState({ isInAppPurchaseInProgress: false });
          }
          InAppUtils.purchaseProduct(products[0].identifier, (err, response) => {
            if (err) {
              // eslint-disable-next-line
              return this.setState({ isInAppPurchaseInProgress: false });
            }
            if (response && response.productIdentifier) {
              // console.log(`t=${response.transactionReceipt}`);
              this.props.verifyInAppPurchase({ receipt: response.transactionReceipt });
              setTimeout(
                () => {
                  this.setState({ isInAppPurchaseInProgress: false });
                },
                1000,
              );
            }
            return null;
          });
        });
      }

      if (this.getSubsciptionModalType() === 5) {
        this.setState({
          showSubscriptionModal: false,
        });
      }
    }
  }

  onSubcriptionModalNoPress() {
    this.props.showNavigationBar();
    this.setState({
      showSubscriptionModal: false,
    });
  }

  onSeeAllRecommendations() {
    this.props.hideNavigationBar();
    this.setState({
      showSubscriptionModal: true,
    });
  }

  async onBookmark(movieSlug) {
    this.setState({
      currentBookmarkedMovies: { ...this.state.currentBookmarkedMovies, [movieSlug]: true },
    });

    this.props.addMovieToWatchList(movieSlug);
    await Promise.delay(1000);


    const { total, movies } = this.props;

    if (!isViewMoreMoviesAllowed(this.props.currentUser)) {
      if (movies.length < 25
         && total > 25
         && this.props.moviesNotYetDisplayed.length < 3) {
        this.props.fetchRecommendedMovies({
          inbox: getCategory(this.state.selectedCategory),
          offset: 24,
          isLoadBackupMovies: true,
        });
      }

      this.setState({
        currentBookmarkedMovies: {},
      });
      this.props.removeMovieFromDisplay({ movieSlug });
    }
  }

  async onClose(movieSlug) {
    this.setState({
      currentDismissedMovies: { ...this.state.currentDismissedMovies, [movieSlug]: true },
    });

    this.props.dismissMovie(movieSlug);
    await Promise.delay(1000);
    const { movies, total } = this.props;

    if (!isViewMoreMoviesAllowed(this.props.currentUser)) {
      if (movies.length < 25
         && total > 25
         && this.props.moviesNotYetDisplayed.length < 3) {
        this.props.fetchRecommendedMovies({
          inbox: getCategory(this.state.selectedCategory),
          offset: 24,
          isLoadBackupMovies: true,
        });
      }

      this.setState({
        currentDismissedMovies: {},
      });
      this.props.removeMovieFromDisplay({ movieSlug });
    }
  }

  onSeen(movie) {
    this.setState({
      currentSeenMovie: movie,
      showQuickReact: true,
    });
  }

  getSubsciptionModalType() {
    const { currentUser } = this.props;

    if (this.state.forceShow4thSubscriptionModal) { return 4; }

    if (isEmpty(currentUser.profile.premium)) {
      return 1;
    }

    if (!isEmpty(currentUser.profile.premium) &&
       currentUser.profile.premium.plan === 'trial' &&
       currentUser.profile.premium.active) {
      return 2;
    }

    if (!isEmpty(currentUser.profile.premium) &&
      currentUser.profile.premium.plan === 'trial' &&
      !currentUser.profile.premium.active) {
      return 3;
    }

    if (!isEmpty(currentUser.profile.premium) &&
      !currentUser.profile.premium.active) {
      return 3;
    }

    if (!isEmpty(currentUser.profile.premium) &&
    currentUser.profile.premium.active) {
      return 5;
    }

    return null;
  }

  showProfileModal() {
    this.props.hideNavigationBar();
    this.setState({
      showModal: true,
    });
  }

  async handleTasteScreenCancel(rated) {
    const { state: { currentSeenMovie } } = this;
    Promise.delay(500).then(() => {
      this.props.showNavigationBar();
    });


    if (rated) {
      const { total, movies } = this.props;
      const { currentRatedMovies } = this.state;

      this.setState({
        showTasteScreen: false,
        showQuickReact: false,
        currentRatedMovies: { ...currentRatedMovies, [currentSeenMovie.slug]: true },
      });

      await Promise.delay(1000);

      if (!isViewMoreMoviesAllowed(this.props.currentUser)) {
        if (movies.length < 25
           && total > 25
           && this.props.moviesNotYetDisplayed.length < 3) {
          this.props.fetchRecommendedMovies({
            inbox: getCategory(this.state.selectedCategory),
            offset: 24,
            isLoadBackupMovies: true,
          });
        }
        this.props.removeMovieFromDisplay({ movieSlug: currentSeenMovie.slug });
      }

      return this.setState({
        showTasteScreen: false,
        showQuickReact: false,
        currentSeenMovie: null,
      });
    }

    return this.setState({
      showTasteScreen: false,
      showQuickReact: false,
      currentSeenMovie: null,
    });
  }

  refreshRecommendations() {
    this.setState({ requestInProgress: true });
    const category = getCategory(this.state.selectedCategory);
    return this.props.fetchRecommendedMovies({ inbox: category });
  }

  handleChangeCategory(selectedCategory) {
    if (this.state.selectedCategory !== selectedCategory) {
      switch (selectedCategory) {
        case 'key1':
        case 'key2':
        case 'key3':
        case 'key4':
        {
          this.setState({
            selectedCategory,
            requestInProgress: true,
          });
          return this.props.fetchRecommendedMovies({ inbox: getCategory(selectedCategory) });
        }
        case 'key5':
        case 'key6':
        case 'key7':
        case 'key8':
        {
          if (!isViewMoreMoviesAllowed(this.props.currentUser)) {
            this.props.hideNavigationBar();
            return this.setState({ showSubscriptionModal: true });
          }
          this.setState({
            selectedCategory,
            requestInProgress: true,
          });
          return this.props.fetchRecommendedMovies({ inbox: getCategory(selectedCategory) });
        }
        default:
          return null;
      }
    }
    return 1;
  }

  handleLoadMore() {
    if (!isViewMoreMoviesAllowed(this.props.currentUser)) {
      return null;
    }

    const { offset, total, isLoading } = this.props;

    const { movies } = this.props;

    if (!isLoading && movies.length < total && (offset < total)) {
      // console.warn(`${movies.length}-${offset}-${total}`);
      const { selectedCategory } = this.state;
      switch (selectedCategory) {
        case 'key1':
        case 'key2':
        case 'key3':
        case 'key4':
        case 'key5':
        case 'key6':
        case 'key7':
        case 'key8':
          return this.props.fetchRecommendedMovies({
            inbox: getCategory(selectedCategory),
            offset: movies.length + 1,
          });
        default:
          return null;
      }
    }
    return null;
  }


  handleCardDismissal() {
    setTimeout(() => {
      this.setState({
        hideRecommendationsNow: true,
        showModal: false,
        showSubscriptionModal: false,
        showResultModal: false,
      });
      this.props.showNavigationBar();
      this.props.clearUserNewSignUp();
    }, 300);
  }

  viewRecommendations() {
    this.setState({ showResultModal: false });
    // this.props.resetRoute({ routeName: 'MainScreen' }); // MainScreen is tab bar screen
  }

  redirectToRatingScreen() {
    this.setState({
      showTasteScreen: true,
    });
  }

  renderModal(alertModal) {
    return (
      <SwipeCards
        cards={this.state.cards}
        handleNope={this.handleCardDismissal}
        handleYup={this.handleCardDismissal}
        onClickHandler={this.handleCardDismissal}
        renderCard={() => alertModal}
        showNope={false}
        showYup={false}
        smoothTransition
      />
    );
  }

  render() {
    let shouldShowRatingModal = false;
    let shouldShowResultsModal = false;
    let modalContent = null;
    const {
      currentUser,
      navigation,
      moviesToDisplay,
      isStartTrialInProgress,
      userNewSignUp,
      isLoading,
    } = this.props;

    const {
      currentBookmarkedMovies,
      currentDismissedMovies,
      currentSeenMovie,
      hideRecommendationsNow,
      showModal,
      showResultModal,
      showTasteScreen,
      showSubscriptionModal,
      showQuickReact,
      showStickyHeader,
      currentRatedMovies,
      requestInProgress,
      isInAppPurchaseInProgress,
    } = this.state;

    // if (showQuickReact) {
    //   return <QuickRate currentSeen={currentSeen} singleMovie />;
    // }


    if ((!isUndefined(navigation) && !isUndefined(navigation.state)) && !hideRecommendationsNow) {
      if (!isUndefined(navigation.state.params) &&
        navigation.state.params.fromGenderScreen) {
        shouldShowRatingModal = false;
        shouldShowResultsModal = true;
      } else { // this block added by Faisal, need to test properly
        shouldShowRatingModal = showModal;
        shouldShowResultsModal = showResultModal;
      }
    } else {
      shouldShowRatingModal = showModal;
      shouldShowResultsModal = showResultModal;
    }
    if (shouldShowRatingModal) {
      modalContent = (
        <RatingModal
          saveToFacebook={this.saveToFacebook}
          saveWithEmail={this.saveWithEmail}
        />
      );
    }


    if (showSubscriptionModal) {
      const {
        image, titleText, yesButtonText, noButtonText, textLine1, textLine2, textLine3,
      } = subscriptionModalConfs[this.getSubsciptionModalType(currentUser)];

      modalContent = (
        <ActionModal
          circularImage
          imageHeight={80}
          imageWidth={80}
          onPressNo={this.onSubcriptionModalNoPress}
          onPressYes={this.onSubcriptionModalYesPress}
          image={image}
          titleText={titleText}
          yesButtonText={yesButtonText}
          noButtonText={noButtonText}
          textLine1={textLine1}
          textLine2={textLine2}
          textLine3={textLine3}
          showSpinner={isStartTrialInProgress || isInAppPurchaseInProgress}
        />
      );
    }

    if (userNewSignUp) { shouldShowResultsModal = userNewSignUp; }

    if (shouldShowResultsModal) {
      modalContent = (
        <TasteResultsModal
          currentUser={currentUser}
          onViewRecommendationsPressed={this.handleCardDismissal}
          data={recommendationModalConfs[USER_LEVEL][USER_RANK]}
        />
      );
    }

    // if (showTasteScreen) {
    //   return <QuickRate />;
    // }
    return (
      <View style={styles.container}>
        <RenderMovies
          categories={filterCategories}
          currentBookmarkedMovies={currentBookmarkedMovies}
          currentDismissedMovies={currentDismissedMovies}
          currentRatedMovies={currentRatedMovies}
          currentUser={currentUser}
          extraData={moviesToDisplay}
          isLoadingAllMovies={requestInProgress} // using for initial movies
          isLoading={isLoading} // using for show loader on pagination
          onBookmark={this.onBookmark}
          onChangeCategory={this.handleChangeCategory}
          onClose={this.onClose}
          onSeeAllRecommendations={this.onSeeAllRecommendations}
          onSeen={this.onSeen}
          recommendedMovies={moviesToDisplay}
          redirectToRatingScreen={this.redirectToRatingScreen}
          selectedCategory={this.state.selectedCategory}
          showProfileModal={this.showProfileModal}
          styles={styles}
          isViewMoreMoviesAllowed={isViewMoreMoviesAllowed(this.props.currentUser)}
          fetchRecommendedMovies={fetchRecommendedMovies}
          showStickyHeader={showStickyHeader}
          onLoadMore={this.handleLoadMore}
        />
        { // make sure below bools TRUE one at a time, also check 1st and 3rd carefully
        (shouldShowResultsModal
          || showSubscriptionModal || shouldShowRatingModal || shouldShowResultsModal) ?
         this.renderModal(modalContent)
        :
         null
        }
        {
          <Modal
            isOpen={showTasteScreen || showQuickReact}
            backdropPressToClose={false}
            swipeToClose={false}
            style={[styles.modal]}
            animationDuration={200}
          >
            <QuickRate
              singleMovie={showQuickReact}
              currentSeenMovie={showQuickReact ? currentSeenMovie : {}}
              onPressClose={this.handleTasteScreenCancel}
              refreshRecommendations={this.refreshRecommendations}
            />
          </Modal>
        }
      </View>
    );
  }
}

RecommendationScreen.propTypes = {
  currentUser: PropTypes.oneOfType([
    PropTypes.object,
  ]),
  fetchRecommendedMovies: PropTypes.func,
  removeMovieFromDisplay: PropTypes.func,
  addMovieToWatchList: PropTypes.func,
  dismissMovie: PropTypes.func,
  movies: PropTypes.arrayOf(PropTypes.shape({
    backdrop: PropTypes.string,
    description: PropTypes.string,
    name: PropTypes.string,
    poster: PropTypes.string,
    slug: PropTypes.string,
    user: PropTypes.oneOfType([
      PropTypes.object,
    ]),
    year: PropTypes.number,
  })),
  moviesToDisplay: PropTypes.arrayOf(PropTypes.shape({
    backdrop: PropTypes.string,
    description: PropTypes.string,
    name: PropTypes.string,
    poster: PropTypes.string,
    slug: PropTypes.string,
    user: PropTypes.oneOfType([
      PropTypes.object,
    ]),
    year: PropTypes.number,
  })),
  moviesNotYetDisplayed: PropTypes.arrayOf(PropTypes.shape({
    backdrop: PropTypes.string,
    description: PropTypes.string,
    name: PropTypes.string,
    poster: PropTypes.string,
    slug: PropTypes.string,
    user: PropTypes.oneOfType([
      PropTypes.object,
    ]),
    year: PropTypes.number,
  })),
  isLoading: PropTypes.bool,
  isStartTrialInProgress: PropTypes.bool,
  hideNavigationBar: PropTypes.func,
  showNavigationBar: PropTypes.func,
  clearRecommendedMovies: PropTypes.func,
  startTrialSubscription: PropTypes.func,
  verifyInAppPurchase: PropTypes.func,
  navigation: PropTypes.oneOfType([
    PropTypes.object,
  ]),
  total: PropTypes.number,
  offset: PropTypes.number,
  userNewSignUp: PropTypes.bool,
  clearUserNewSignUp: PropTypes.func,
};

RecommendationScreen.defaultProps = {
  fetchRecommendedMovies: () => null,
  removeMovieFromDisplay: () => null,
  movies: [{
    backdrop: '',
    description: '',
    name: '',
    poster: '',
    slug: '',
    user: {},
    year: 0,
  }],
  moviesToDisplay: [{
    backdrop: '',
    description: '',
    name: '',
    poster: '',
    slug: '',
    user: {},
    year: 0,
  }],
  moviesNotYetDisplayed: [{
    backdrop: '',
    description: '',
    name: '',
    poster: '',
    slug: '',
    user: {},
    year: 0,
  }],
  isLoading: false,
  isStartTrialInProgress: false,
  total: 0,
  offset: 0,
  hideNavigationBar: () => null,
  showNavigationBar: () => null,
  addMovieToWatchList: () => null,
  clearRecommendedMovies: () => null,
  dismissMovie: () => null,
  startTrialSubscription: () => null,
  verifyInAppPurchase: () => null,
  navigation: {},
  currentUser: {},
  userNewSignUp: false,
  clearUserNewSignUp: () => null,
};

const mapStateToProps = (state) => {
  const movies = getMovies(state);
  const moviesToDisplay = getMoviesToDisplay(state);
  const moviesNotYetDisplayed = getMoviesNotYetDisplayed(state);
  const isLoading = isRequestInProgress(state);

  // TODO: use object destructuring
  const offset = state.recommendations.offset;  // eslint-disable-line
  const total = state.recommendations.total;    // eslint-disable-line
  const isStartTrialInProgress = state.startTrial.inProgress;    // eslint-disable-line
  const userNewSignUp = state.globalFlags.userNewSignUp;    // eslint-disable-line


  return {
    movies,
    moviesToDisplay,
    moviesNotYetDisplayed,
    isLoading,
    offset,
    total,
    currentUser: state.auth.currentUser,
    auth: state.auth,
    isStartTrialInProgress,
    userNewSignUp,
  };
};

const mapDispatchToProps = dispatch => ({
  navigate: route => dispatch(navigate(route)),
  fetchRecommendedMovies: category => dispatch(fetchRecommendedMovies(category)),
  removeMovieFromDisplay: movieSlug => dispatch(removeMovieFromDisplay(movieSlug)),
  showNavigationBar: () => dispatch(showNavigationBar()),
  hideNavigationBar: () => dispatch(hideNavigationBar()),
  emptyRecommendedMovies: () => dispatch(clearRecommendedMovies()),
  addMovieToWatchList: movieSlug => dispatch(addMovieToWatchList(movieSlug)),
  dismissMovie: movieSlug => dispatch(dismissMovie(movieSlug)),
  startTrialSubscription: payload => dispatch(startTrialSubscription(payload)),
  clearUserNewSignUp: () => dispatch(clearUserNewSignUp()),
  verifyInAppPurchase: payload => dispatch(verifyInAppPurchase(payload)),
});

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(RecommendationScreen);
